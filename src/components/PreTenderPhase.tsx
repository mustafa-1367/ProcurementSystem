import { useState } from 'react';
import { Plus, Upload, FileText, Calendar, DollarSign, Building, Shield, CheckCircle } from 'lucide-react';
import { addProcurementRecord } from '../utils/blockchain';

interface PreTenderPhaseProps {
  tenders: any[];
  setTenders: (tenders: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
}

export function PreTenderPhase({ tenders, setTenders, setBlockchainRecords, blockchainRecords }: PreTenderPhaseProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    budget: '',
    category: '',
    deadline: '',
    requirements: '',
  });

  const handleCreateTender = async (e: React.FormEvent) => {
    e.preventDefault();

    const newTender = {
      id: `TND-${Date.now()}`,
      ...formData,
      status: 'draft',
      createdAt: new Date().toISOString(),
      publishedAt: null,
    };

    // Add to blockchain
    const { block, contract } = addProcurementRecord('tender', {
      title: formData.title,
      budget: formData.budget,
      deadline: formData.deadline,
      department: formData.department,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'tender_created',
      tenderId: newTender.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: true,
    };

    setTenders([...tenders, newTender]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setShowCreateForm(false);
    setFormData({
      title: '',
      description: '',
      department: '',
      budget: '',
      category: '',
      deadline: '',
      requirements: '',
    });
  };

  const publishTender = (tenderId: string) => {
    const updatedTenders = tenders.map((t) =>
      t.id === tenderId ? { ...t, status: 'published', publishedAt: new Date().toISOString() } : t
    );

    const tender = tenders.find((t) => t.id === tenderId);

    // Add publish event to blockchain
    const { block, contract } = addProcurementRecord('tender', {
      action: 'publish',
      tenderId,
      title: tender.title,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'tender_published',
      tenderId,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: true,
    };

    setTenders(updatedTenders);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
  };

  const categories = [
    'Infrastructure',
    'IT & Technology',
    'Healthcare',
    'Education',
    'Defense',
    'Agriculture',
    'Transportation',
  ];

  const departments = [
    'Ministry of Finance',
    'Ministry of Public Works',
    'Ministry of Health',
    'Ministry of Education',
    'Ministry of Defense',
    'Ministry of Agriculture',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Pre-Tender Phase</h2>
          <p className="text-gray-600 mt-1">Create and prepare tenders before publishing</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create New Tender
        </button>
      </div>

      {/* Create Tender Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-gray-900">New Tender Details</h3>
            <Shield className="w-6 h-6 text-green-600" />
          </div>

          <form onSubmit={handleCreateTender} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">Tender Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Road Construction Project"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Department</label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Budget (AFN)</label>
                <input
                  type="number"
                  required
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 5000000"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Category</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Submission Deadline</label>
                <input
                  type="date"
                  required
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Description</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Detailed description of the tender..."
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Requirements & Specifications</label>
              <textarea
                required
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Technical requirements, qualifications, documents needed..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                Create & Record on Blockchain
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tender List */}
      <div className="space-y-4">
        <h3 className="text-gray-900">All Tenders</h3>

        {tenders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No tenders created yet</p>
            <p className="text-gray-500 mt-2">Click "Create New Tender" to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tenders.map((tender) => (
              <div key={tender.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-gray-900">{tender.title}</h4>
                      <span
                        className={`px-3 py-1 rounded-full text-white ${
                          tender.status === 'published' ? 'bg-green-600' : 'bg-yellow-600'
                        }`}
                      >
                        {tender.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-4">{tender.description}</p>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Building className="w-4 h-4" />
                        <span>{tender.department}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <DollarSign className="w-4 h-4" />
                        <span>{Number(tender.budget).toLocaleString()} AFN</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(tender.deadline).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <FileText className="w-4 h-4" />
                        <span>{tender.category}</span>
                      </div>
                    </div>
                  </div>

                  {tender.status === 'draft' && (
                    <button
                      onClick={() => publishTender(tender.id)}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors ml-4"
                    >
                      <Upload className="w-4 h-4" />
                      Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
