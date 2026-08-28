import { useState } from 'react';
import { Link as LinkIcon, Shield, CheckCircle, Hash, Clock, FileText, Search, TrendingUp } from 'lucide-react';
import { blockchain } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface BlockchainDashboardProps {
  blockchainRecords: any[];
  userRole: string;
}

export function BlockchainDashboard({ blockchainRecords, userRole }: BlockchainDashboardProps) {
  const [searchHash, setSearchHash] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [verifiedRecords, setVerifiedRecords] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  const handleVerify = (recordId: string) => {
    if (verifiedRecords.has(recordId) || userRole !== 'citizen') return;
    setVerifiedRecords(new Set([...verifiedRecords, recordId]));
  };

  const chain = blockchain.getChain();
  const isValid = blockchain.verifyChain();

  const filteredRecords = searchHash
    ? blockchainRecords.filter(
        (r) =>
          r.transactionHash.toLowerCase().includes(searchHash.toLowerCase()) ||
          r.id.toLowerCase().includes(searchHash.toLowerCase())
      )
    : blockchainRecords;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'tender_created':
      case 'tender_published':
        return 'bg-blue-100 text-blue-800';
      case 'bid_submitted':
        return 'bg-purple-100 text-purple-800';
      case 'contract_awarded':
        return 'bg-green-100 text-green-800';
      case 'payment_processed':
        return 'bg-amber-100 text-amber-900';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tender_created':
      case 'tender_published':
        return <FileText className="w-4 h-4" />;
      case 'bid_submitted':
        return <TrendingUp className="w-4 h-4" />;
      case 'contract_awarded':
        return <CheckCircle className="w-4 h-4" />;
      case 'payment_processed':
        return <LinkIcon className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900">{t('blockchain.title')}</h2>
        <p className="text-gray-600 mt-1">{t('blockchain.subtitle')}</p>
      </div>


      {/* Blockchain Status */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('blockchain.totalBlocks')}</p>
              <p className="text-gray-900 mt-1">{chain.length}</p>
            </div>
            <LinkIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('blockchain.transactions')}</p>
              <p className="text-gray-900 mt-1">{blockchainRecords.length}</p>
            </div>
            <Hash className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('blockchain.chainStatus')}</p>
              <p className={`mt-1 ${isValid ? 'text-green-700' : 'text-red-600'}`}>
                {isValid ? t('blockchain.valid') : t('blockchain.invalid')}
              </p>
            </div>
            <Shield className={`w-8 h-8 ${isValid ? 'text-green-700' : 'text-red-600'}`} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('blockchain.latestBlock')}</p>
              <p className="text-gray-900 mt-1">#{chain[chain.length - 1]?.index || 0}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchHash}
            onChange={(e) => setSearchHash(e.target.value)}
            placeholder={t('blockchain.searchPlaceholder')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Blockchain Visualization */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-gray-900">{t('blockchain.blockchainStructure')}</h3>
        </div>
        <div className="p-6 overflow-x-auto">
          <div className="flex items-center gap-4 min-w-max">
            {chain.slice(-5).map((block, index) => (
              <div key={block.index} className="flex items-center">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg p-4 min-w-[200px]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>{t('blockchain.block')} #{block.index}</span>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <p className="truncate">{t('blockchain.hash')} {block.hash.substring(0, 16)}...</p>
                      <p className="truncate">{t('blockchain.prev')} {block.previousHash.substring(0, 16)}...</p>
                      <p>{t('blockchain.nonce')} {block.nonce}</p>
                    </div>
                  </div>
                </div>
                {index < chain.slice(-5).length - 1 && (
                  <div className="flex items-center">
                    <div className="w-8 h-0.5 bg-gray-300"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full -ml-1"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction Records */}
      <div className="space-y-4">
        <h3 className="text-gray-900">{t('blockchain.transactionHistory')}</h3>

        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('blockchain.noTransactions')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords
              .slice()
              .reverse()
              .map((record) => (
                <button
                  key={record.id}
                  type="button"
                  aria-expanded={selectedRecord?.id === record.id}
                  className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer w-full text-start focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getTypeIcon(record.type)}
                          <span
                            className={`px-3 py-1 rounded-full ${getTypeColor(record.type)}`}
                          >
                            {record.type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          {record.onChain ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t('blockchain.onChain')}
                            </span>
                          ) : record.simulated ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                              {t('blockchain.simulated')}
                            </span>
                          ) : record.verified ? (
                            <span className="flex items-center gap-1 text-green-700">
                              <CheckCircle className="w-4 h-4" />
                              {t('blockchain.verified')}
                            </span>
                          ) : null}
                          {userRole === 'citizen' && !verifiedRecords.has(record.id) && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleVerify(record.id); }}
                              className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-xs font-semibold hover:bg-emerald-100 transition-colors"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              {t('rewards.verifyBtn')} (+10 TOK)
                            </button>
                          )}
                          {userRole === 'citizen' && verifiedRecords.has(record.id) && (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t('rewards.citizenVerified')}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-gray-600 mt-3">
                          <div>
                            <p className="text-gray-500">{t('blockchain.transactionHash')}</p>
                            <p className="font-mono">{record.transactionHash.substring(0, 32)}...</p>
                          </div>
                          <div>
                            <p className="text-gray-500">{t('blockchain.blockId')}</p>
                            <p className="font-mono">{record.id.substring(0, 16)}...</p>
                          </div>
                          <div>
                            <p className="text-gray-500">{t('blockchain.smartContract')}</p>
                            <p className="font-mono">{record.contractId || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">{t('blockchain.timestamp')}</p>
                            <p>{new Date(record.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedRecord?.id === record.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-gray-900 mb-3">{t('blockchain.fullDetails')}</h4>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <pre className="text-gray-700 overflow-x-auto">
                            {JSON.stringify(
                              {
                                id: record.id,
                                type: record.type,
                                transactionHash: record.transactionHash,
                                contractId: record.contractId,
                                tenderId: record.tenderId,
                                bidId: record.bidId,
                                contractId_award: record.smartContractId,
                                timestamp: record.timestamp,
                                verified: record.verified,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Blockchain Integrity Check */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <Shield className={`w-8 h-8 ${isValid ? 'text-green-700' : 'text-red-600'}`} />
          <div>
            <h3 className="text-gray-900">{t('blockchain.integrityTitle')}</h3>
            <p className={`mt-1 ${isValid ? 'text-green-700' : 'text-red-600'}`}>
              {isValid
                ? t('blockchain.integrityValid')
                : t('blockchain.integrityInvalid')}
            </p>
          </div>
        </div>

        {isValid && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-800">{t('blockchain.hashValidation')}</p>
              <p className="text-green-700 mt-1">✓ {t('blockchain.hashVerified')}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-800">{t('blockchain.chainLinkage')}</p>
              <p className="text-green-700 mt-1">✓ {t('blockchain.blocksLinked')}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-800">{t('blockchain.proofOfWork')}</p>
              <p className="text-green-700 mt-1">✓ {t('blockchain.validDifficulty')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
