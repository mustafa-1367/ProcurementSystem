/**
 * Demo data generator for the Afghan Procurement Prototype.
 * All dates are relative to Date.now() so the data always looks current.
 * IDs are fixed strings (not timestamp-based) to ensure cross-references stay consistent.
 */

const DAY = 24 * 60 * 60 * 1000;

function isoAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

function isoAhead(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString();
}

function txHash(seed: string): string {
  // Deterministic fake tx hash from a seed string
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(h).toString(16).padStart(8, '0');
  return `0x${hex}${'a]1b2c3d4e5f60718293a4b5c6d7e8f9'.repeat(4)}`.slice(0, 66);
}

// ─── Supplier IDs (fixed) ───────────────────────────────────────────────────

const SUP = {
  afghanStar: 'SUP-DEMO-001',
  kabulTech: 'SUP-DEMO-002',
  heratTrading: 'SUP-DEMO-003',
  balkh: 'SUP-DEMO-004',
  pashtunServices: 'SUP-DEMO-005',
  ariana: 'SUP-DEMO-006',
  hindukush: 'SUP-DEMO-007',
  safi: 'SUP-DEMO-008',
  mazar: 'SUP-DEMO-009',
  nangarhar: 'SUP-DEMO-010',
};

// ─── Tender IDs ─────────────────────────────────────────────────────────────

const TND = {
  highway: 'TND-DEMO-001',
  school: 'TND-DEMO-002',
  hospital: 'TND-DEMO-003',
  itInfra: 'TND-DEMO-004',
  water: 'TND-DEMO-005',
  agri: 'TND-DEMO-006',
};

// ─── Bid IDs ────────────────────────────────────────────────────────────────

const BID = {
  hw1: 'BID-DEMO-001',
  hw2: 'BID-DEMO-002',
  hw3: 'BID-DEMO-003',
  sc1: 'BID-DEMO-004',
  sc2: 'BID-DEMO-005',
  sc3: 'BID-DEMO-006',
  ho1: 'BID-DEMO-007',
  ho2: 'BID-DEMO-008',
  ho3: 'BID-DEMO-009',
  it1: 'BID-DEMO-010',
  it2: 'BID-DEMO-011',
  it3: 'BID-DEMO-012',
  ag1: 'BID-DEMO-013',
  ag2: 'BID-DEMO-014',
};

// ─── Contract IDs ───────────────────────────────────────────────────────────

const CNT = {
  highway: 'CNT-DEMO-001',
  itInfra: 'CNT-DEMO-002',
};

export function generateDemoData() {
  // ═══════════════════════════════════════════════════════════════════════════
  //  REGISTERED SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════════════

  const registeredSuppliers = [
    {
      id: SUP.afghanStar,
      companyName: 'Afghan Star Construction Co.',
      registrationNumber: 'AISA-2019-04821',
      representative: 'Ahmad Shah Durrani',
      email: 'info@afghanstar.af',
      taxId: 'TIN-AF-30291',
      beneficialOwnership: 'Ahmad Shah Durrani (100%)',
      registeredAt: isoAgo(180),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.kabulTech,
      companyName: 'Kabul Technology Solutions',
      registrationNumber: 'AISA-2020-07553',
      representative: 'Farida Ahmadi',
      email: 'contact@kabultech.af',
      taxId: 'TIN-AF-44102',
      beneficialOwnership: 'Farida Ahmadi (60%), Noor Ahmad (40%)',
      registeredAt: isoAgo(150),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.heratTrading,
      companyName: 'Herat General Trading LLC',
      registrationNumber: 'AISA-2018-02145',
      representative: 'Mohammad Ismail Qasimi',
      email: 'sales@herattrading.af',
      taxId: 'TIN-AF-18903',
      beneficialOwnership: 'Mohammad Ismail Qasimi (100%)',
      registeredAt: isoAgo(300),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.balkh,
      companyName: 'Balkh Medical Supplies Ltd.',
      registrationNumber: 'AISA-2021-11287',
      representative: 'Dr. Nasreen Popal',
      email: 'procurement@balkhmedical.af',
      taxId: 'TIN-AF-55710',
      beneficialOwnership: 'Dr. Nasreen Popal (70%), Hamid Reza (30%)',
      registeredAt: isoAgo(120),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.pashtunServices,
      companyName: 'Pashtun Engineering Services',
      registrationNumber: 'AISA-2017-00932',
      representative: 'Eng. Wali Khan',
      email: 'wali@pashtuneng.af',
      taxId: 'TIN-AF-09284',
      beneficialOwnership: 'Wali Khan (50%), Karim Shah (50%)',
      registeredAt: isoAgo(400),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.ariana,
      companyName: 'Ariana Office Equipment',
      registrationNumber: 'AISA-2022-15601',
      representative: 'Zahra Karimi',
      email: 'info@arianaoffice.af',
      taxId: 'TIN-AF-66201',
      beneficialOwnership: 'Zahra Karimi (100%)',
      registeredAt: isoAgo(90),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: false,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.hindukush,
      companyName: 'Hindukush Water Engineering',
      registrationNumber: 'AISA-2019-08776',
      representative: 'Eng. Najibullah Stanikzai',
      email: 'projects@hindukushwater.af',
      taxId: 'TIN-AF-33409',
      beneficialOwnership: 'Najibullah Stanikzai (80%), Sayed Rahim (20%)',
      registeredAt: isoAgo(200),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.safi,
      companyName: 'Safi Agricultural Machinery',
      registrationNumber: 'AISA-2020-10345',
      representative: 'Ghulam Safi',
      email: 'ghulam@safimachinery.af',
      taxId: 'TIN-AF-41900',
      beneficialOwnership: 'Ghulam Safi (100%)',
      registeredAt: isoAgo(160),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.mazar,
      companyName: 'Mazar-i-Sharif Logistics Co.',
      registrationNumber: 'AISA-2021-13908',
      representative: 'Rahim Balkhi',
      email: 'rahim@mazarlogistics.af',
      taxId: 'TIN-AF-58312',
      beneficialOwnership: 'Rahim Balkhi (65%), Fatima Balkhi (35%)',
      registeredAt: isoAgo(110),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: false,
        antiCorruptionDeclaration: true,
      },
    },
    {
      id: SUP.nangarhar,
      companyName: 'Nangarhar Farm Equipment Ltd.',
      registrationNumber: 'AISA-2023-17422',
      representative: 'Sayed Noor',
      email: 'sayed@nangarharfarm.af',
      taxId: 'TIN-AF-72105',
      beneficialOwnership: 'Sayed Noor (100%)',
      registeredAt: isoAgo(45),
      eligible: true,
      checks: {
        businessRegistration: true,
        taxClearance: true,
        notDebarred: true,
        noConflictOfInterest: true,
        bidSecurity: true,
        auditedFinancials: true,
        antiCorruptionDeclaration: true,
      },
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  TENDERS
  // ═══════════════════════════════════════════════════════════════════════════

  const tenders = [
    {
      id: TND.highway,
      title: 'Kabul\u2013Jalalabad Highway Rehabilitation',
      description: 'Rehabilitation of 152 km of the Kabul\u2013Jalalabad highway including resurfacing, drainage improvements, and safety barriers installation per MOTPW standards.',
      department: 'Ministry of Transport & Public Works',
      budget: '480000000',
      category: 'Infrastructure',
      deadline: isoAgo(45),
      requirements: 'Minimum 10 years road construction experience. ISO 9001 certified. Equipment fleet capable of 5 km/month. Previous government contracts above 200M AFN.',
      procurementType: 'Works',
      method: 'Open Competitive Bidding (NCB)',
      budgetLine: 'MOTPW-FY1403-CAP-0012',
      status: 'awarded',
      createdAt: isoAgo(90),
      publishedAt: isoAgo(85),
    },
    {
      id: TND.school,
      title: 'Herat Provincial School Supplies',
      description: 'Supply of textbooks, stationery, laboratory equipment, and classroom furniture for 45 schools across Herat Province under the Education Quality Improvement Program.',
      department: 'Ministry of Education',
      budget: '35000000',
      category: 'Education',
      deadline: isoAhead(12),
      requirements: 'Registered supplier of educational materials. Demonstrated capacity to deliver to rural areas. Past contracts with MoE preferred.',
      procurementType: 'Goods',
      method: 'Open Competitive Bidding (NCB)',
      budgetLine: 'MOE-FY1403-EQIP-0087',
      status: 'published',
      createdAt: isoAgo(20),
      publishedAt: isoAgo(18),
    },
    {
      id: TND.hospital,
      title: 'Balkh Regional Hospital Medical Equipment',
      description: 'Procurement of diagnostic imaging equipment (CT scanner, X-ray, ultrasound), surgical instruments, and ICU monitoring systems for the 200-bed Balkh Regional Hospital upgrade.',
      department: 'Ministry of Public Health',
      budget: '195000000',
      category: 'Healthcare',
      deadline: isoAgo(10),
      requirements: 'Authorized distributor of CE/FDA-approved medical devices. Installation and 3-year warranty required. After-sales service center in northern Afghanistan.',
      procurementType: 'Goods',
      method: 'Open Competitive Bidding (ICB)',
      budgetLine: 'MOPH-FY1403-EQUIP-0034',
      status: 'standstill',
      createdAt: isoAgo(60),
      publishedAt: isoAgo(55),
    },
    {
      id: TND.itInfra,
      title: 'Ministry of Finance IT Infrastructure',
      description: 'Design, supply, and installation of data center infrastructure, network switches, firewalls, and end-user computing devices for the Ministry of Finance modernization project.',
      department: 'Ministry of Finance',
      budget: '125000000',
      category: 'Technology',
      deadline: isoAgo(30),
      requirements: 'Cisco/HP/Dell partner certification. Minimum 5 years ICT infrastructure experience. ISO 27001 compliance. On-site support team in Kabul.',
      procurementType: 'Goods',
      method: 'Open Competitive Bidding (NCB)',
      budgetLine: 'MOF-FY1403-ICT-0019',
      status: 'awarded',
      createdAt: isoAgo(75),
      publishedAt: isoAgo(70),
    },
    {
      id: TND.water,
      title: 'Kandahar Water Supply Network Extension',
      description: 'Extension of the municipal water supply network to 12 underserved neighborhoods in Kandahar City, including pipe laying, pump stations, and 3 elevated storage tanks.',
      department: 'Ministry of Urban Development',
      budget: '310000000',
      category: 'Infrastructure',
      deadline: isoAhead(30),
      requirements: 'Licensed civil engineering firm. Experience with municipal water systems. Equipment for pipe laying in urban areas.',
      procurementType: 'Works',
      method: 'Open Competitive Bidding (NCB)',
      budgetLine: 'MOUD-FY1403-WAT-0006',
      status: 'draft',
      createdAt: isoAgo(5),
      publishedAt: null,
    },
    {
      id: TND.agri,
      title: 'Nangarhar Agricultural Equipment Procurement',
      description: 'Supply of tractors, combine harvesters, irrigation pumps, and seed drills for the Nangarhar Agricultural Development Program supporting 2,000 farming households.',
      department: 'Ministry of Agriculture, Irrigation & Livestock',
      budget: '78000000',
      category: 'Agriculture',
      deadline: isoAhead(20),
      requirements: 'Authorized dealer of agricultural machinery. Spare parts supply chain in eastern Afghanistan. Training capability for end-users.',
      procurementType: 'Goods',
      method: 'Open Competitive Bidding (NCB)',
      budgetLine: 'MAIL-FY1403-MECH-0041',
      status: 'published',
      createdAt: isoAgo(14),
      publishedAt: isoAgo(12),
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  BIDS
  // ═══════════════════════════════════════════════════════════════════════════

  const bids = [
    // --- Kabul-Jalalabad Highway (awarded) ---
    {
      id: BID.hw1,
      tenderId: TND.highway,
      tenderTitle: 'Kabul\u2013Jalalabad Highway Rehabilitation',
      vendorName: 'Afghan Star Construction Co.',
      vendorEmail: 'info@afghanstar.af',
      amount: '465000000',
      timeline: '24 months',
      status: 'submitted',
      submittedAt: isoAgo(50),
      evaluated: true,
      score: 88.5,
    },
    {
      id: BID.hw2,
      tenderId: TND.highway,
      tenderTitle: 'Kabul\u2013Jalalabad Highway Rehabilitation',
      vendorName: 'Pashtun Engineering Services',
      vendorEmail: 'wali@pashtuneng.af',
      amount: '472000000',
      timeline: '22 months',
      status: 'submitted',
      submittedAt: isoAgo(48),
      evaluated: true,
      score: 82.3,
    },
    {
      id: BID.hw3,
      tenderId: TND.highway,
      tenderTitle: 'Kabul\u2013Jalalabad Highway Rehabilitation',
      vendorName: 'Hindukush Water Engineering',
      vendorEmail: 'projects@hindukushwater.af',
      amount: '490000000',
      timeline: '26 months',
      status: 'submitted',
      submittedAt: isoAgo(47),
      evaluated: true,
      score: 74.1,
    },

    // --- Herat School Supplies (published, bids received) ---
    {
      id: BID.sc1,
      tenderId: TND.school,
      tenderTitle: 'Herat Provincial School Supplies',
      vendorName: 'Herat General Trading LLC',
      vendorEmail: 'sales@herattrading.af',
      amount: '32500000',
      timeline: '6 months',
      status: 'submitted',
      submittedAt: isoAgo(8),
      evaluated: false,
      score: null,
    },
    {
      id: BID.sc2,
      tenderId: TND.school,
      tenderTitle: 'Herat Provincial School Supplies',
      vendorName: 'Ariana Office Equipment',
      vendorEmail: 'info@arianaoffice.af',
      amount: '34200000',
      timeline: '5 months',
      status: 'submitted',
      submittedAt: isoAgo(6),
      evaluated: false,
      score: null,
    },
    {
      id: BID.sc3,
      tenderId: TND.school,
      tenderTitle: 'Herat Provincial School Supplies',
      vendorName: 'Mazar-i-Sharif Logistics Co.',
      vendorEmail: 'rahim@mazarlogistics.af',
      amount: '33800000',
      timeline: '7 months',
      status: 'submitted',
      submittedAt: isoAgo(5),
      evaluated: false,
      score: null,
    },

    // --- Balkh Hospital (standstill, evaluated) ---
    {
      id: BID.ho1,
      tenderId: TND.hospital,
      tenderTitle: 'Balkh Regional Hospital Medical Equipment',
      vendorName: 'Balkh Medical Supplies Ltd.',
      vendorEmail: 'procurement@balkhmedical.af',
      amount: '188000000',
      timeline: '8 months',
      status: 'submitted',
      submittedAt: isoAgo(18),
      evaluated: true,
      score: 91.2,
    },
    {
      id: BID.ho2,
      tenderId: TND.hospital,
      tenderTitle: 'Balkh Regional Hospital Medical Equipment',
      vendorName: 'Kabul Technology Solutions',
      vendorEmail: 'contact@kabultech.af',
      amount: '192000000',
      timeline: '10 months',
      status: 'submitted',
      submittedAt: isoAgo(16),
      evaluated: true,
      score: 78.4,
    },
    {
      id: BID.ho3,
      tenderId: TND.hospital,
      tenderTitle: 'Balkh Regional Hospital Medical Equipment',
      vendorName: 'Herat General Trading LLC',
      vendorEmail: 'sales@herattrading.af',
      amount: '201000000',
      timeline: '9 months',
      status: 'submitted',
      submittedAt: isoAgo(15),
      evaluated: true,
      score: 72.8,
    },

    // --- Ministry of Finance IT (awarded, contract in progress) ---
    {
      id: BID.it1,
      tenderId: TND.itInfra,
      tenderTitle: 'Ministry of Finance IT Infrastructure',
      vendorName: 'Kabul Technology Solutions',
      vendorEmail: 'contact@kabultech.af',
      amount: '118500000',
      timeline: '12 months',
      status: 'submitted',
      submittedAt: isoAgo(38),
      evaluated: true,
      score: 93.7,
    },
    {
      id: BID.it2,
      tenderId: TND.itInfra,
      tenderTitle: 'Ministry of Finance IT Infrastructure',
      vendorName: 'Ariana Office Equipment',
      vendorEmail: 'info@arianaoffice.af',
      amount: '124000000',
      timeline: '14 months',
      status: 'submitted',
      submittedAt: isoAgo(36),
      evaluated: true,
      score: 79.5,
    },
    {
      id: BID.it3,
      tenderId: TND.itInfra,
      tenderTitle: 'Ministry of Finance IT Infrastructure',
      vendorName: 'Mazar-i-Sharif Logistics Co.',
      vendorEmail: 'rahim@mazarlogistics.af',
      amount: '130000000',
      timeline: '15 months',
      status: 'submitted',
      submittedAt: isoAgo(35),
      evaluated: true,
      score: 68.2,
    },

    // --- Nangarhar Agricultural Equipment (published, bidding open) ---
    {
      id: BID.ag1,
      tenderId: TND.agri,
      tenderTitle: 'Nangarhar Agricultural Equipment Procurement',
      vendorName: 'Safi Agricultural Machinery',
      vendorEmail: 'ghulam@safimachinery.af',
      amount: '74500000',
      timeline: '4 months',
      status: 'submitted',
      submittedAt: isoAgo(3),
      evaluated: false,
      score: null,
    },
    {
      id: BID.ag2,
      tenderId: TND.agri,
      tenderTitle: 'Nangarhar Agricultural Equipment Procurement',
      vendorName: 'Nangarhar Farm Equipment Ltd.',
      vendorEmail: 'sayed@nangarharfarm.af',
      amount: '76200000',
      timeline: '5 months',
      status: 'submitted',
      submittedAt: isoAgo(2),
      evaluated: false,
      score: null,
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONTRACTS (with milestone tracking)
  // ═══════════════════════════════════════════════════════════════════════════

  const contracts = [
    // Contract 1: Highway - awarded, standstill complete, active with progress
    {
      id: CNT.highway,
      tenderId: TND.highway,
      tenderTitle: 'Kabul\u2013Jalalabad Highway Rehabilitation',
      bidId: BID.hw1,
      vendorName: 'Afghan Star Construction Co.',
      vendorEmail: 'info@afghanstar.af',
      amount: '465000000',
      timeline: '24 months',
      status: 'active',
      awardDecisionDate: isoAgo(40),
      standstillEndDate: isoAgo(33),
      awardedAt: isoAgo(40),
      evaluationSummary: {
        technicalScore: 85,
        financialScore: 92,
        combinedScore: 88.5,
      },
      milestones: [
        { id: 1, name: 'Initial Payment (30%)', percentage: 30, status: 'paid', amount: 139500000, paidAt: isoAgo(30) },
        { id: 2, name: 'Mid-project Payment (40%)', percentage: 40, status: 'pending', amount: 186000000 },
        { id: 3, name: 'Final Payment (30%)', percentage: 30, status: 'pending', amount: 139500000 },
      ],
      progress: 35,
    },

    // Contract 2: IT Infrastructure - awarded, active, more progress
    {
      id: CNT.itInfra,
      tenderId: TND.itInfra,
      tenderTitle: 'Ministry of Finance IT Infrastructure',
      bidId: BID.it1,
      vendorName: 'Kabul Technology Solutions',
      vendorEmail: 'contact@kabultech.af',
      amount: '118500000',
      timeline: '12 months',
      status: 'active',
      awardDecisionDate: isoAgo(25),
      standstillEndDate: isoAgo(18),
      awardedAt: isoAgo(25),
      evaluationSummary: {
        technicalScore: 95,
        financialScore: 92,
        combinedScore: 93.7,
      },
      milestones: [
        { id: 1, name: 'Initial Payment (30%)', percentage: 30, status: 'paid', amount: 35550000, paidAt: isoAgo(15) },
        { id: 2, name: 'Mid-project Payment (40%)', percentage: 40, status: 'paid', amount: 47400000, paidAt: isoAgo(5) },
        { id: 3, name: 'Final Payment (30%)', percentage: 30, status: 'pending', amount: 35550000 },
      ],
      progress: 70,
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  BLOCKCHAIN RECORDS
  // ═══════════════════════════════════════════════════════════════════════════

  const blockchainRecords = [
    // Tender creation records
    {
      id: 'BLK-DEMO-001',
      type: 'tender_created',
      tenderId: TND.highway,
      contractId: 'SC-DEMO-001',
      transactionHash: txHash('tender-highway'),
      timestamp: isoAgo(90),
      verified: false,
      simulated: true,
      onChain: false,
    },
    {
      id: 'BLK-DEMO-002',
      type: 'tender_created',
      tenderId: TND.school,
      contractId: 'SC-DEMO-002',
      transactionHash: txHash('tender-school'),
      timestamp: isoAgo(20),
      verified: false,
      simulated: true,
      onChain: false,
    },
    {
      id: 'BLK-DEMO-003',
      type: 'tender_created',
      tenderId: TND.hospital,
      contractId: 'SC-DEMO-003',
      transactionHash: txHash('tender-hospital'),
      timestamp: isoAgo(60),
      verified: false,
      simulated: true,
      onChain: false,
    },
    {
      id: 'BLK-DEMO-004',
      type: 'tender_created',
      tenderId: TND.itInfra,
      contractId: 'SC-DEMO-004',
      transactionHash: txHash('tender-itinfra'),
      timestamp: isoAgo(75),
      verified: false,
      simulated: true,
      onChain: false,
    },
    {
      id: 'BLK-DEMO-005',
      type: 'tender_created',
      tenderId: TND.agri,
      contractId: 'SC-DEMO-005',
      transactionHash: txHash('tender-agri'),
      timestamp: isoAgo(14),
      verified: false,
      simulated: true,
      onChain: false,
    },
    // Bid submission records
    {
      id: 'BLK-DEMO-010',
      type: 'bid_submitted',
      bidId: BID.hw1,
      tenderId: TND.highway,
      contractId: 'SC-DEMO-010',
      transactionHash: txHash('bid-hw1'),
      timestamp: isoAgo(50),
      verified: false,
      simulated: true,
      onChain: false,
    },
    {
      id: 'BLK-DEMO-011',
      type: 'bid_submitted',
      bidId: BID.it1,
      tenderId: TND.itInfra,
      contractId: 'SC-DEMO-011',
      transactionHash: txHash('bid-it1'),
      timestamp: isoAgo(38),
      verified: false,
      simulated: true,
      onChain: false,
    },
    // Contract award records
    {
      id: 'BLK-DEMO-020',
      type: 'contract_awarded',
      tenderId: TND.highway,
      contractId: CNT.highway,
      smartContractId: 'SC-DEMO-020',
      transactionHash: txHash('award-highway'),
      timestamp: isoAgo(40),
      verified: false,
      simulated: true,
      onChain: false,
    },
    {
      id: 'BLK-DEMO-021',
      type: 'contract_awarded',
      tenderId: TND.itInfra,
      contractId: CNT.itInfra,
      smartContractId: 'SC-DEMO-021',
      transactionHash: txHash('award-itinfra'),
      timestamp: isoAgo(25),
      verified: false,
      simulated: true,
      onChain: false,
    },
    // Payment milestone records
    {
      id: 'BLK-DEMO-030',
      type: 'milestone_paid',
      contractId: CNT.highway,
      milestoneId: 1,
      amount: 139500000,
      transactionHash: txHash('payment-hw-m1'),
      timestamp: isoAgo(30),
      verified: false,
      simulated: true,
      onChain: false,
    },
    {
      id: 'BLK-DEMO-031',
      type: 'milestone_paid',
      contractId: CNT.itInfra,
      milestoneId: 1,
      amount: 35550000,
      transactionHash: txHash('payment-it-m1'),
      timestamp: isoAgo(15),
      verified: false,
      simulated: true,
      onChain: false,
    },
    {
      id: 'BLK-DEMO-032',
      type: 'milestone_paid',
      contractId: CNT.itInfra,
      milestoneId: 2,
      amount: 47400000,
      transactionHash: txHash('payment-it-m2'),
      timestamp: isoAgo(5),
      verified: false,
      simulated: true,
      onChain: false,
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  DISPUTES / OBJECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const disputes = [
    {
      id: 'OBJ-DEMO-001',
      tenderId: TND.highway,
      tenderTitle: 'Kabul\u2013Jalalabad Highway Rehabilitation',
      title: 'Objection: Evaluation Scoring Discrepancy',
      description: 'Pashtun Engineering Services objects to the evaluation scoring, claiming that their technical score did not account for their ISO 14001 environmental certification and 15 years of road construction experience in similar terrain.',
      relatedId: TND.highway,
      grounds: 'Technical evaluation did not properly credit ISO 14001 certification and comparable project experience per Article 43 of the Procurement Law.',
      type: 'evaluation_objection',
      status: 'resolved',
      filedAt: isoAgo(38),
      createdAt: isoAgo(38),
      stage: 5,
      votes: { approve: 3, reject: 7, totalVoters: 10 },
      votingDeadline: isoAgo(31),
      resolution: 'Objection reviewed by the Evaluation Committee. Scoring methodology confirmed compliant with procurement guidelines. ISO 14001 was credited under the qualification stage but is not a separate technical scoring criterion. Objection dismissed.',
      routingDecision: null,
      flaggedForReReview: false,
    },
    {
      id: 'DSP-DEMO-001',
      tenderId: TND.hospital,
      tenderTitle: 'Balkh Regional Hospital Medical Equipment',
      title: 'Conflict of Interest Allegation \u2014 Balkh Hospital Tender',
      description: 'An oversight complaint alleging that a member of the evaluation committee has a financial relationship with Balkh Medical Supplies Ltd., the top-ranked bidder.',
      relatedId: TND.hospital,
      type: 'oversight_complaint',
      status: 'voting',
      filedAt: isoAgo(7),
      createdAt: isoAgo(7),
      stage: 2,
      votes: { approve: 4, reject: 1, totalVoters: 5 },
      votingDeadline: isoAhead(3),
      resolution: null,
      routingDecision: null,
      flaggedForReReview: false,
      evidence: 'Financial disclosure documents and social media connections suggest a familial relationship between committee member and company representative.',
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  WHISTLEBLOWER REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  const reports = [
    {
      id: 'RPT-DEMO-001',
      title: 'Bid Rigging in Highway Tender',
      category: 'bid_rigging',
      severity: 'high',
      relatedId: TND.highway,
      description: 'Evidence suggests that two of the bidding companies coordinated their pricing before submission. Communication records indicate pre-bid meetings between company representatives where pricing strategies were discussed.',
      evidence: 'Phone records and meeting logs showing coordination between bidder representatives prior to submission deadline.',
      reporterType: 'insider',
      routedTo: 'sao',
      isAnonymous: true,
      zkProof: 'ZKP-DEMO-A1B2C3D4E5F6',
      zkpVerified: true,
      status: 'under_investigation',
      submittedAt: isoAgo(35),
      investigationStatus: 'active',
      rewards: {
        eligible: true,
        amount: 500,
        status: 'pending_investigation',
      },
      referrals: [
        {
          authority: 'sao',
          referredAt: isoAgo(34),
          blockchainRecordId: 'BLK-DEMO-040',
        },
      ],
    },
    {
      id: 'RPT-DEMO-002',
      title: 'Substandard Materials Used in IT Equipment',
      category: 'fraud',
      severity: 'medium',
      relatedId: TND.itInfra,
      description: 'Report that some network switches delivered under the MoF IT Infrastructure contract are counterfeit units with forged manufacturer labels. Serial numbers do not match the manufacturer database.',
      evidence: 'Photos of equipment labels and serial number verification results from the manufacturer portal showing mismatches.',
      reporterType: 'government_employee',
      routedTo: 'national_inspector',
      isAnonymous: true,
      zkProof: 'ZKP-DEMO-F6E5D4C3B2A1',
      zkpVerified: true,
      status: 'submitted',
      submittedAt: isoAgo(10),
      investigationStatus: 'pending',
      rewards: {
        eligible: true,
        amount: 250,
        status: 'pending_investigation',
      },
      referrals: [],
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  REPUTATION SCORES
  //  (The ReputationSystem component derives scores dynamically from bids +
  //   contracts, so this array can seed override / historical data.)
  // ═══════════════════════════════════════════════════════════════════════════

  const reputationScores = [
    { vendorName: 'Afghan Star Construction Co.', score: 88.5, tier: 'Gold', updatedAt: isoAgo(1) },
    { vendorName: 'Kabul Technology Solutions', score: 93.7, tier: 'Platinum', updatedAt: isoAgo(1) },
    { vendorName: 'Herat General Trading LLC', score: 72.0, tier: 'Silver', updatedAt: isoAgo(1) },
    { vendorName: 'Balkh Medical Supplies Ltd.', score: 85.0, tier: 'Gold', updatedAt: isoAgo(1) },
    { vendorName: 'Pashtun Engineering Services', score: 78.3, tier: 'Gold', updatedAt: isoAgo(1) },
    { vendorName: 'Ariana Office Equipment', score: 65.0, tier: 'Silver', updatedAt: isoAgo(1) },
    { vendorName: 'Hindukush Water Engineering', score: 74.1, tier: 'Silver', updatedAt: isoAgo(1) },
    { vendorName: 'Safi Agricultural Machinery', score: 80.0, tier: 'Gold', updatedAt: isoAgo(1) },
    { vendorName: 'Mazar-i-Sharif Logistics Co.', score: 60.5, tier: 'Silver', updatedAt: isoAgo(1) },
    { vendorName: 'Nangarhar Farm Equipment Ltd.', score: 55.0, tier: 'Bronze', updatedAt: isoAgo(1) },
  ];

  return {
    tenders,
    bids,
    contracts,
    blockchainRecords,
    disputes,
    reports,
    reputationScores,
    registeredSuppliers,
  };
}
