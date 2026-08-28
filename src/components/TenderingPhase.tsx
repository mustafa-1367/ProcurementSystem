import { useState } from 'react';
import { FileText, Banknote, Calendar, Building, Send, Eye, Shield, TrendingDown, Lock, CheckCircle } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface TenderingPhaseProps {
  tenders: any[];
  setTenders: (tenders: any[]) => void;
  bids: any[];
  setBids: (bids: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  reputationScores: any[];
  userRole: string;
}

export function TenderingPhase({
  tenders,
  setTenders,
  bids,
  setBids,
  setBlockchainRecords,
  blockchainRecords,
  reputationScores,
  userRole,
}: TenderingPhaseProps) {
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidSuccess, setBidSuccess] = useState<{ bidId: string; tenderTitle: string; vendorName: string; amount: string; onChain: boolean } | null>(null);
  const [bidForm, setBidForm] = useState({
    vendorName: '',
    vendorEmail: '',
    amount: '',
    timeline: '',
    technicalProposal: '',
    experience: '',
  });
  const { t } = useTranslation();

  const publishedTenders = tenders.filter((td) => td.status === 'published');

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();

    const newBid = {
      id: `BID-${Date.now()}`,
      tenderId: selectedTender.id,
      tenderTitle: selectedTender.title,
      ...bidForm,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      evaluated: false,
      score: null,
    };

    const { block, contract, onChain } = await addProcurementRecordAsync('bid', {
      tenderId: selectedTender.id,
      amount: bidForm.amount,
      vendor: bidForm.vendorName,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'bid_submitted',
      tenderId: selectedTender.id,
      bidId: newBid.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain, simulated: !onChain, onChain,
    };

    setBids([...bids, newBid]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setShowBidForm(false);
    setBidSuccess({
      bidId: newBid.id,
      tenderTitle: selectedTender.title,
      vendorName: bidForm.vendorName,
      amount: bidForm.amount,
      onChain,
    });
    setBidForm({
      vendorName: '',
      vendorEmail: '',
      amount: '',
      timeline: '',
      technicalProposal: '',
      experience: '',
    });
  };

  const getTenderBids = (tenderId: string) => {
    return bids.filter((b) => b.tenderId === tenderId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900">{t('tendering.title')}</h2>
        <p className="text-gray-600 mt-1">
          {userRole === 'government' ? t('tendering.subtitleEntity') : t('tendering.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900">{t('tendering.publishedTenders')}</h3>

        {publishedTenders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('tendering.noPublished')}</p>
            <p className="text-gray-500 mt-2">{t('tendering.tendersAppear')}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {publishedTenders.map((tender) => {
              const tenderBids = getTenderBids(tender.id);
              const daysRemaining = Math.ceil(
                (new Date(tender.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const deadlinePassed = new Date(tender.deadline).getTime() <= Date.now();

              return (
                <div key={tender.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-gray-900">{tender.title}</h4>
                          <span className="px-3 py-1 bg-green-100 text-green-900 rounded-full">
                            {t('tendering.openForBidding')}
                          </span>
                          {blockchainRecords.some(r => r.tenderId === tender.id && r.onChain) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                          )}
                        </div>
                        <p className="text-gray-600">{tender.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Building className="w-4 h-4" />
                        <span>{tender.department}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Banknote className="w-4 h-4" />
                        <span>{Number(tender.budget).toLocaleString()} {t('tendering.afn')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {daysRemaining > 0 ? `${daysRemaining} ${t('tendering.daysLeft')}` : t('tendering.expired')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <FileText className="w-4 h-4" />
                        <span>{tenderBids.length} {t('tendering.bids')}</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <p className="text-gray-700">{tender.requirements}</p>
                    </div>

                    <div className="flex gap-3">
                      {userRole !== 'government' && (
                        <button
                          onClick={() => {
                            setSelectedTender(tender);
                            setShowBidForm(true);
                          }}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none"
                        >
                          <Send className="w-4 h-4" />
                          {t('tendering.submitBid')}
                        </button>
                      )}
                      {deadlinePassed ? (
                        <button
                          onClick={() => setSelectedTender(selectedTender?.id === tender.id ? null : tender)}
                          className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          {t('tendering.viewBids')} ({tenderBids.length})
                        </button>
                      ) : (
                        <>
                          <span className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg text-sm font-medium">
                            <Lock className="w-4 h-4" />
                            {t('audit.bidsSealed')} ({tenderBids.length})
                          </span>
                          {userRole === 'government' && (
                            <button
                              onClick={() => {
                                const updated = tenders.map((td) =>
                                  td.id === tender.id ? { ...td, deadline: new Date(Date.now() - 1000).toISOString() } : td
                                );
                                setTenders(updated);
                              }}
                              style={{ fontSize: '11.5px', padding: '6px 10px', borderRadius: 8, border: '1px dashed #d1d5db', background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Skip to Deadline (Demo)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {selectedTender?.id === tender.id && !showBidForm && tenderBids.length > 0 && deadlinePassed && (
                    <div className="border-t border-gray-200 p-6 bg-gray-50">
                      <h4 className="text-gray-900 mb-4">{t('tendering.submittedBids')}</h4>
                      <div className="space-y-3">
                        {tenderBids.map((bid) => (
                          <div key={bid.id} className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-gray-900">{bid.vendorName}</span>
                                  <span className="flex items-center gap-1 text-green-700">
                                    <Shield className="w-4 h-4" />
                                    {t('tendering.verified')}
                                  </span>
                                  {blockchainRecords.some(r => r.bidId === bid.id && r.onChain) && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <Banknote className="w-4 h-4" />
                                    {Number(bid.amount).toLocaleString()} {t('tendering.afn')}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {bid.timeline}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4" />
                                    {((Number(bid.amount) / Number(tender.budget)) * 100).toFixed(1)}{t('tendering.ofBudget')}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`px-3 py-1 rounded-full ${
                                  bid.evaluated
                                    ? 'bg-blue-100 text-blue-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {bid.evaluated ? t('tendering.evaluated') : t('tendering.pending')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showBidForm && selectedTender && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-gray-900">{t('tendering.submitBid')}</h3>
                  <p className="text-gray-600 mt-1">{selectedTender.title}</p>
                </div>
                <Shield className="w-6 h-6 text-green-600" />
              </div>
            </div>

            <form onSubmit={handleSubmitBid} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">{t('tendering.vendorName')}</label>
                  <input
                    type="text"
                    required
                    value={bidForm.vendorName}
                    onChange={(e) => setBidForm({ ...bidForm, vendorName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('tendering.vendorPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">{t('tendering.contactEmail')}</label>
                  <input
                    type="email"
                    required
                    value={bidForm.vendorEmail}
                    onChange={(e) => setBidForm({ ...bidForm, vendorEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('tendering.emailPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">{t('tendering.bidAmount')}</label>
                  <input
                    type="number"
                    required
                    value={bidForm.amount}
                    onChange={(e) => setBidForm({ ...bidForm, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('tendering.amountPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">{t('tendering.completionTimeline')}</label>
                  <input
                    type="text"
                    required
                    value={bidForm.timeline}
                    onChange={(e) => setBidForm({ ...bidForm, timeline: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('tendering.timelinePlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">{t('tendering.technicalProposal')}</label>
                <textarea
                  required
                  value={bidForm.technicalProposal}
                  onChange={(e) => setBidForm({ ...bidForm, technicalProposal: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('tendering.proposalPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">{t('tendering.relevantExperience')}</label>
                <textarea
                  required
                  value={bidForm.experience}
                  onChange={(e) => setBidForm({ ...bidForm, experience: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('tendering.experiencePlaceholder')}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none"
                >
                  <Shield className="w-5 h-5" />
                  {t('tendering.submitRecord')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBidForm(false);
                    setSelectedTender(null);
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('tendering.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bid Submission Success Modal */}
      {bidSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 480, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ background: '#ecfdf5', padding: '32px 24px', textAlign: 'center', borderBottom: '1px solid #a7f3d0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle style={{ width: 32, height: 32, color: '#065f46' }} />
              </div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 700, color: '#065f46' }}>Bid Submitted Successfully</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#047857' }}>Your bid has been recorded and sealed.</p>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Tender</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{bidSuccess.tenderTitle}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Bidder</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{bidSuccess.vendorName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Bid Amount</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{Number(bidSuccess.amount).toLocaleString()} AFN</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Bid ID</span>
                  <span style={{ fontWeight: 600, color: '#0f2942', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{bidSuccess.bidId}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Lock style={{ width: 12, height: 12 }} /> Sealed & Encrypted
                </span>
                {bidSuccess.onChain && (
                  <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ● Recorded On-Chain
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setBidSuccess(null);
                  setSelectedTender(null);
                }}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#0f2942', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
