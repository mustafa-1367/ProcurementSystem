import { useState } from 'react';
import { Send, FileText, DollarSign, Calendar, Building, Eye, Upload, ShieldCheck } from 'lucide-react';
import { addProcurementRecord } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface SubmitBidProps {
  tenders: any[];
  bids: any[];
  setBids: (bids: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
}

export function SubmitBid({ tenders, bids, setBids, setBlockchainRecords, blockchainRecords }: SubmitBidProps) {
  const { t } = useTranslation();
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [viewTender, setViewTender] = useState<any>(null);
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidForm, setBidForm] = useState({
    vendorName: '',
    vendorEmail: '',
    amount: '',
    timeline: '',
  });

  const publishedTenders = tenders.filter((td) => td.status === 'published');
  const myBids = bids;

  const handleSubmitBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTender) return;

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

    const updatedBids = [...bids, newBid];
    setBids(updatedBids);

    addProcurementRecord(
      { type: 'bid_submission', bidId: newBid.id, tenderId: selectedTender.id, vendor: bidForm.vendorName, amount: bidForm.amount, timestamp: Date.now() },
      setBlockchainRecords,
      blockchainRecords
    );

    setBidForm({ vendorName: '', vendorEmail: '', amount: '', timeline: '' });
    setShowBidForm(false);
    setSelectedTender(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 text-xl font-semibold">{t('submitBid.title')}</h2>
        <p className="text-gray-600 mt-1">{t('submitBid.subtitle')}</p>
      </div>

      {/* My Submitted Bids */}
      {myBids.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-gray-900 font-semibold">{t('submitBid.myBids')}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {myBids.map((bid: any) => (
              <div key={bid.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{bid.tenderTitle}</div>
                  <div className="text-sm text-gray-500">{bid.id} &middot; {new Date(bid.submittedAt).toLocaleDateString()}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  bid.status === 'submitted' ? 'bg-blue-50 text-blue-700' :
                  bid.status === 'awarded' ? 'bg-green-50 text-green-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {bid.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Tenders */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-gray-900 font-semibold">{t('submitBid.availableTenders')}</h3>
        </div>
        {publishedTenders.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">{t('submitBid.noTenders')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {publishedTenders.map((tender: any) => (
              <div key={tender.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{tender.title}</div>
                    <div className="text-sm text-gray-500">{tender.department} &middot; {t('submitBid.budget')}: {tender.budget?.toLocaleString()} AFN</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewTender(viewTender?.id === tender.id ? null : tender)}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="w-4 h-4" /> {t('submitBid.view')}
                    </button>
                    <button
                      onClick={() => { setSelectedTender(tender); setShowBidForm(true); }}
                      className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
                    >
                      <Send className="w-4 h-4" /> {t('submitBid.submitBtn')}
                    </button>
                  </div>
                </div>
                {tender.description && (
                  <p className="text-sm text-gray-600">{tender.description}</p>
                )}
                {viewTender?.id === tender.id && (
                  <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 16, marginTop: 10 }}>
                    <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.department')}</div>
                        <div style={{ fontSize: '13.5px', color: '#0b0b0b' }}>{tender.department}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.budget')}</div>
                        <div style={{ fontSize: '13.5px', color: '#0b0b0b' }}>{Number(tender.budget).toLocaleString()} AFN</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.category')}</div>
                        <div style={{ fontSize: '13.5px', color: '#0b0b0b' }}>{tender.category}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.submissionDeadline')}</div>
                        <div style={{ fontSize: '13.5px', color: '#0b0b0b' }}>{new Date(tender.deadline).toLocaleDateString()}</div>
                      </div>
                    </div>
                    {tender.requirements && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.requirements')}</div>
                        <div style={{ fontSize: '13.5px', color: '#52514e' }}>{tender.requirements}</div>
                      </div>
                    )}
                    {tender.method && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.procurementMethod')}</div>
                        <div style={{ fontSize: '13.5px', color: '#52514e' }}>{tender.method}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bid Submission Form Modal */}
      {showBidForm && selectedTender && (
        <div className="fixed z-50 flex items-center justify-center p-4" style={{ top: 110, left: 0, right: 0, bottom: 0 }}>
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowBidForm(false)} aria-hidden="true"></div>
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full z-10 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-gray-900 font-semibold">{t('submitBid.formTitle')}: {selectedTender.title}</h3>
              <button onClick={() => setShowBidForm(false)} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmitBid} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Building className="w-4 h-4 inline me-1" />
                    {t('submitBid.vendorName')} *
                  </label>
                  <input
                    value={bidForm.vendorName}
                    onChange={(e) => setBidForm({ ...bidForm, vendorName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('submitBid.vendorEmail')} *
                  </label>
                  <input
                    type="email"
                    value={bidForm.vendorEmail}
                    onChange={(e) => setBidForm({ ...bidForm, vendorEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="w-4 h-4 inline me-1" />
                    {t('submitBid.amount')} (AFN) *
                  </label>
                  <input
                    type="number"
                    value={bidForm.amount}
                    onChange={(e) => setBidForm({ ...bidForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline me-1" />
                    {t('submitBid.timeline')}
                  </label>
                  <input
                    value={bidForm.timeline}
                    onChange={(e) => setBidForm({ ...bidForm, timeline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder={t('submitBid.timelinePlaceholder')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline me-1" />
                  {t('submitBid.technicalSpecDocs')}
                </label>
                <input
                  type="file"
                  multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <ShieldCheck className="w-4 h-4 inline me-1" />
                  {t('submitBid.bidSecurity')}
                </label>
                <input
                  type="file"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />

              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Upload className="w-4 h-4 inline me-1" />
                  {t('submitBid.documents')}
                </label>
                <input
                  type="file"
                  multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">{t('submitBid.documentsHint')}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Send className="w-4 h-4" /> {t('submitBid.submitBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBidForm(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {t('submitBid.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
