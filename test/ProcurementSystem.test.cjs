const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

// Mirrors src/utils/commitReveal.ts's computeCommitment exactly:
// keccak256(abi.encode(uint256 amount, bytes32 salt))
function commitmentFor(amount, salt) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  return ethers.keccak256(coder.encode(["uint256", "bytes32"], [amount, salt]));
}

const SEEDED_DIRECTOR = "0x15bFf92fe34e25633dc2F91834EE6d921002f55F";

describe("ProcurementSystem", function () {
  let procurement, owner, creator, bidderA, bidderB, director, memberA, memberB, memberC, outsider;

  beforeEach(async function () {
    [owner, creator, bidderA, bidderB, director, memberA, memberB, memberC, outsider] =
      await ethers.getSigners();

    const ProcurementSystem = await ethers.getContractFactory("ProcurementSystem");
    procurement = await ProcurementSystem.deploy();
    await procurement.waitForDeployment();

    // Authorize a normal test-signer Director for most tests (the seeded
    // address from the constructor is tested separately via impersonation,
    // since it's a fixed external address Hardhat's default signers won't
    // match).
    await procurement.connect(owner).setAuthorizedDirector(director.address, true);
  });

  async function createPublishedTender(deadlineOffsetSeconds = 3600) {
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + deadlineOffsetSeconds;
    const tx = await procurement.connect(creator).createTender("Test Tender", 1000000, deadline);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "TenderCreated");
    const tenderId = event.args[0];
    await procurement.connect(creator).publishTender(tenderId);
    return { tenderId, deadline };
  }

  async function passDeadline(deadline) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
    await ethers.provider.send("evm_mine", []);
  }

  describe("Commit-reveal bidding (#1)", function () {
    it("stores only the commitment at submission — amount is 0 and unrevealed", async function () {
      const { tenderId } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const commitment = commitmentFor(500000, salt);

      const tx = await procurement.connect(bidderA).commitBid(tenderId, commitment);
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted");
      const bidId = event.args[1];

      const bid = await procurement.bidsById(bidId);
      expect(bid.revealed).to.equal(false);
      expect(bid.amount).to.equal(0n);
      expect(bid.commitment).to.equal(commitment);
    });

    it("reveals successfully when (amount, salt) matches the commitment, after the deadline", async function () {
      const { tenderId, deadline } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const amount = 777777n;
      const commitment = commitmentFor(amount, salt);

      const commitTx = await procurement.connect(bidderA).commitBid(tenderId, commitment);
      const commitReceipt = await commitTx.wait();
      const bidId = commitReceipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await passDeadline(deadline);

      await expect(procurement.connect(bidderA).revealBid(tenderId, bidId, amount, salt))
        .to.emit(procurement, "BidRevealed")
        .withArgs(tenderId, bidId, bidderA.address, amount);

      const bid = await procurement.bidsById(bidId);
      expect(bid.revealed).to.equal(true);
      expect(bid.amount).to.equal(amount);
    });

    it("rejects a reveal with the wrong amount — integrity enforced on-chain, not by the app", async function () {
      const { tenderId, deadline } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const commitment = commitmentFor(500000, salt);

      const commitTx = await procurement.connect(bidderA).commitBid(tenderId, commitment);
      const commitReceipt = await commitTx.wait();
      const bidId = commitReceipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await passDeadline(deadline);

      await expect(
        procurement.connect(bidderA).revealBid(tenderId, bidId, 999999, salt)
      ).to.be.revertedWith("Reveal does not match commitment");
    });

    it("rejects a reveal with the wrong salt", async function () {
      const { tenderId, deadline } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const wrongSalt = ethers.hexlify(ethers.randomBytes(32));
      const commitment = commitmentFor(500000, salt);

      const commitTx = await procurement.connect(bidderA).commitBid(tenderId, commitment);
      const commitReceipt = await commitTx.wait();
      const bidId = commitReceipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await passDeadline(deadline);

      await expect(
        procurement.connect(bidderA).revealBid(tenderId, bidId, 500000, wrongSalt)
      ).to.be.revertedWith("Reveal does not match commitment");
    });

    it("rejects someone other than the original bidder revealing", async function () {
      const { tenderId, deadline } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const commitment = commitmentFor(500000, salt);

      const commitTx = await procurement.connect(bidderA).commitBid(tenderId, commitment);
      const commitReceipt = await commitTx.wait();
      const bidId = commitReceipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await passDeadline(deadline);

      await expect(
        procurement.connect(bidderB).revealBid(tenderId, bidId, 500000, salt)
      ).to.be.revertedWith("Only the bidder can reveal their own bid");
    });

    it("rejects reveal before the deadline", async function () {
      const { tenderId } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const commitment = commitmentFor(500000, salt);

      const commitTx = await procurement.connect(bidderA).commitBid(tenderId, commitment);
      const commitReceipt = await commitTx.wait();
      const bidId = commitReceipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await expect(
        procurement.connect(bidderA).revealBid(tenderId, bidId, 500000, salt)
      ).to.be.revertedWith("Reveal opens after deadline");
    });

    it("submitBidDirect (Single-Source) is immediately revealed with no commitment", async function () {
      const { tenderId } = await createPublishedTender();
      const tx = await procurement.connect(bidderA).submitBidDirect(tenderId, 1234567);
      const receipt = await tx.wait();
      const bidId = receipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidRevealed").args[1];

      const bid = await procurement.bidsById(bidId);
      expect(bid.revealed).to.equal(true);
      expect(bid.amount).to.equal(1234567n);
      expect(bid.commitment).to.equal(ethers.ZeroHash);
    });
  });

  describe("Evaluation Committee + on-chain winner computation (#3)", function () {
    it("proposeCommittee only allows the tender creator", async function () {
      const { tenderId } = await createPublishedTender();
      await expect(
        procurement.connect(outsider).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address])
      ).to.be.revertedWith("Only the tender creator can propose a committee");
    });

    it("proposeCommittee rejects duplicate seat addresses", async function () {
      const { tenderId } = await createPublishedTender();
      await expect(
        procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberA.address, memberC.address])
      ).to.be.revertedWith("Committee seats must be distinct addresses");
      await expect(
        procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberA.address])
      ).to.be.revertedWith("Committee seats must be distinct addresses");
    });

    it("approveCommittee rejects a non-authorized-Director caller", async function () {
      const { tenderId } = await createPublishedTender();
      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);
      await expect(
        procurement.connect(outsider).approveCommittee(tenderId)
      ).to.be.revertedWith("Not an authorized Director");
    });

    it("approveCommittee rejects the same address that proposed it", async function () {
      const { tenderId } = await createPublishedTender();
      await procurement.connect(owner).setAuthorizedDirector(creator.address, true);
      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);
      await expect(
        procurement.connect(creator).approveCommittee(tenderId)
      ).to.be.revertedWith("Cannot approve your own proposal");
    });

    it("approves successfully with a distinct authorized Director", async function () {
      const { tenderId } = await createPublishedTender();
      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);
      await expect(procurement.connect(director).approveCommittee(tenderId))
        .to.emit(procurement, "CommitteeApproved")
        .withArgs(tenderId, director.address);
      expect(await procurement.committeeApproved(tenderId)).to.equal(true);
    });

    it("the seeded constructor Director address can approve (impersonated)", async function () {
      const { tenderId } = await createPublishedTender();
      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);

      await ethers.provider.send("hardhat_impersonateAccount", [SEEDED_DIRECTOR]);
      await ethers.provider.send("hardhat_setBalance", [SEEDED_DIRECTOR, "0x56BC75E2D63100000"]); // 100 ETH
      const seededSigner = await ethers.getSigner(SEEDED_DIRECTOR);

      expect(await procurement.authorizedDirectors(SEEDED_DIRECTOR)).to.equal(true);
      await expect(procurement.connect(seededSigner).approveCommittee(tenderId))
        .to.emit(procurement, "CommitteeApproved");
    });

    it("rejects votes from a non-committee-member", async function () {
      const { tenderId, deadline } = await createPublishedTender();
      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);
      await procurement.connect(director).approveCommittee(tenderId);
      const bidId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      await passDeadline(deadline);
      await expect(
        procurement.connect(outsider).voteOnBid(tenderId, bidId, true, true)
      ).to.be.revertedWith("Not a committee member for this tender");
    });

    it("isBidQualified requires a 2-of-3 majority on both preliminary and qualification", async function () {
      const { tenderId, deadline } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const amount = 500000n;
      const commitTx = await procurement.connect(bidderA).commitBid(tenderId, commitmentFor(amount, salt));
      const commitReceipt = await commitTx.wait();
      const bidId = commitReceipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);
      await procurement.connect(director).approveCommittee(tenderId);
      await passDeadline(deadline);
      await procurement.connect(bidderA).revealBid(tenderId, bidId, amount, salt);

      expect(await procurement.isBidQualified(tenderId, bidId)).to.equal(false);

      await procurement.connect(memberA).voteOnBid(tenderId, bidId, true, true);
      expect(await procurement.isBidQualified(tenderId, bidId)).to.equal(false); // only 1 of 3

      await procurement.connect(memberB).voteOnBid(tenderId, bidId, true, true);
      expect(await procurement.isBidQualified(tenderId, bidId)).to.equal(true); // 2 of 3 majority

      await procurement.connect(memberC).voteOnBid(tenderId, bidId, false, false);
      expect(await procurement.isBidQualified(tenderId, bidId)).to.equal(true); // still 2-1 majority
    });

    it("finalizeAward picks the lowest-amount bid among qualified ones — not an app-supplied outcome", async function () {
      const { tenderId, deadline } = await createPublishedTender();

      const saltA = ethers.hexlify(ethers.randomBytes(32));
      const saltB = ethers.hexlify(ethers.randomBytes(32));
      const amountA = 900000n; // cheaper, but will NOT reach majority
      const amountB = 950000n; // pricier, but WILL reach majority — should still win

      const txA = await procurement.connect(bidderA).commitBid(tenderId, commitmentFor(amountA, saltA));
      const rA = await txA.wait();
      const bidIdA = rA.logs.map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      const txB = await procurement.connect(bidderB).commitBid(tenderId, commitmentFor(amountB, saltB));
      const rB = await txB.wait();
      const bidIdB = rB.logs.map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);
      await procurement.connect(director).approveCommittee(tenderId);

      await passDeadline(deadline);
      await procurement.connect(bidderA).revealBid(tenderId, bidIdA, amountA, saltA);
      await procurement.connect(bidderB).revealBid(tenderId, bidIdB, amountB, saltB);

      // Bid A (cheaper): only 1 of 3 votes pass — not qualified
      await procurement.connect(memberA).voteOnBid(tenderId, bidIdA, true, true);
      await procurement.connect(memberB).voteOnBid(tenderId, bidIdA, false, false);
      await procurement.connect(memberC).voteOnBid(tenderId, bidIdA, false, false);

      // Bid B (pricier): 2 of 3 votes pass — qualified
      await procurement.connect(memberA).voteOnBid(tenderId, bidIdB, true, true);
      await procurement.connect(memberB).voteOnBid(tenderId, bidIdB, true, true);
      await procurement.connect(memberC).voteOnBid(tenderId, bidIdB, false, false);

      await expect(procurement.connect(outsider).finalizeAward(tenderId)) // callable by anyone
        .to.emit(procurement, "ContractAwarded")
        .withArgs(tenderId, bidIdB, bidderB.address, amountB);

      const tender = await procurement.tenders(tenderId);
      expect(tender.awarded).to.equal(true);
    });

    it("finalizeAward reverts when no bid reached a qualified majority", async function () {
      const { tenderId, deadline } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const amount = 500000n;
      const commitTx = await procurement.connect(bidderA).commitBid(tenderId, commitmentFor(amount, salt));
      const commitReceipt = await commitTx.wait();
      const bidId = commitReceipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);
      await procurement.connect(director).approveCommittee(tenderId);
      await passDeadline(deadline);
      await procurement.connect(bidderA).revealBid(tenderId, bidId, amount, salt);
      await procurement.connect(memberA).voteOnBid(tenderId, bidId, false, false);

      await expect(procurement.connect(creator).finalizeAward(tenderId))
        .to.be.revertedWith("No qualified revealed bid");
    });

    it("finalizeAward reverts before the deadline", async function () {
      const { tenderId } = await createPublishedTender();
      await expect(procurement.connect(creator).finalizeAward(tenderId))
        .to.be.revertedWith("Deadline not passed");
    });

    it("finalizeAward cannot be called twice", async function () {
      const { tenderId, deadline } = await createPublishedTender();
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const amount = 500000n;
      const commitTx = await procurement.connect(bidderA).commitBid(tenderId, commitmentFor(amount, salt));
      const commitReceipt = await commitTx.wait();
      const bidId = commitReceipt.logs
        .map((l) => { try { return procurement.interface.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "BidCommitted").args[1];

      await procurement.connect(creator).proposeCommittee(tenderId, [memberA.address, memberB.address, memberC.address]);
      await procurement.connect(director).approveCommittee(tenderId);
      await passDeadline(deadline);
      await procurement.connect(bidderA).revealBid(tenderId, bidId, amount, salt);
      await procurement.connect(memberA).voteOnBid(tenderId, bidId, true, true);
      await procurement.connect(memberB).voteOnBid(tenderId, bidId, true, true);

      await procurement.connect(creator).finalizeAward(tenderId);
      await expect(procurement.connect(creator).finalizeAward(tenderId))
        .to.be.revertedWith("Already awarded");
    });
  });
});
