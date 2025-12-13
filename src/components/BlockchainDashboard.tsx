import { useState } from 'react';
import { Link as LinkIcon, Shield, CheckCircle, Hash, Clock, FileText, Search, TrendingUp } from 'lucide-react';
import { blockchain } from '../utils/blockchain';

interface BlockchainDashboardProps {
  blockchainRecords: any[];
}

export function BlockchainDashboard({ blockchainRecords }: BlockchainDashboardProps) {
  const [searchHash, setSearchHash] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

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
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
        <h2 className="text-gray-900">Blockchain Transaction Records</h2>
        <p className="text-gray-600 mt-1">Immutable ledger of all procurement activities</p>
      </div>

      {/* Blockchain Status */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Total Blocks</p>
              <p className="text-gray-900 mt-1">{chain.length}</p>
            </div>
            <LinkIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Transactions</p>
              <p className="text-gray-900 mt-1">{blockchainRecords.length}</p>
            </div>
            <Hash className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Chain Status</p>
              <p className={`mt-1 ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                {isValid ? 'Valid' : 'Invalid'}
              </p>
            </div>
            <Shield className={`w-8 h-8 ${isValid ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Latest Block</p>
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
            placeholder="Search by transaction hash or block ID..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Blockchain Visualization */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-gray-900">Blockchain Structure</h3>
        </div>
        <div className="p-6 overflow-x-auto">
          <div className="flex items-center gap-4 min-w-max">
            {chain.slice(-5).map((block, index) => (
              <div key={block.index} className="flex items-center">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg p-4 min-w-[200px]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Block #{block.index}</span>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="text-xs opacity-90">
                      <p className="truncate">Hash: {block.hash.substring(0, 16)}...</p>
                      <p className="truncate">Prev: {block.previousHash.substring(0, 16)}...</p>
                      <p>Nonce: {block.nonce}</p>
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
        <h3 className="text-gray-900">Transaction History</h3>

        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No transactions recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords
              .slice()
              .reverse()
              .map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
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
                          {record.verified && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              Verified
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-gray-600 mt-3">
                          <div>
                            <p className="text-gray-500">Transaction Hash</p>
                            <p className="font-mono">{record.transactionHash.substring(0, 32)}...</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Block ID</p>
                            <p className="font-mono">{record.id.substring(0, 16)}...</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Smart Contract</p>
                            <p className="font-mono">{record.contractId || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Timestamp</p>
                            <p>{new Date(record.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedRecord?.id === record.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-gray-900 mb-3">Full Transaction Details</h4>
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
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Blockchain Integrity Check */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <Shield className={`w-8 h-8 ${isValid ? 'text-green-600' : 'text-red-600'}`} />
          <div>
            <h3 className="text-gray-900">Blockchain Integrity</h3>
            <p className={`mt-1 ${isValid ? 'text-green-600' : 'text-red-600'}`}>
              {isValid
                ? 'All blocks are valid and chain integrity is maintained'
                : 'Chain integrity compromised - blocks have been tampered with'}
            </p>
          </div>
        </div>

        {isValid && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-800">Hash Validation</p>
              <p className="text-green-600 mt-1">✓ All hashes verified</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-800">Chain Linkage</p>
              <p className="text-green-600 mt-1">✓ All blocks linked correctly</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-800">Proof of Work</p>
              <p className="text-green-600 mt-1">✓ Valid mining difficulty</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
