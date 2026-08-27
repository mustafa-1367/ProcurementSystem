import { useState } from 'react';
import { HelpCircle, Book, BookOpen, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export function HelpSupport() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'faq' | 'glossary' | 'userGuide' | 'howItWorks'>('faq');

  const faqKeys = [0, 1, 2, 3, 4, 5, 6, 7];
  const glossaryKeys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const guideKeys = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const howStepKeys = [0, 1, 2, 3, 4, 5];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900 text-xl font-semibold">{t('help.title')}</h2>
        <p className="text-gray-600 mt-1">{t('help.subtitle')}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
            activeTab === 'faq'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          {t('help.faqTab')}
        </button>
        <button
          onClick={() => setActiveTab('glossary')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
            activeTab === 'glossary'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Book className="w-4 h-4" />
          {t('help.glossaryTab')}
        </button>
        <button
          onClick={() => setActiveTab('userGuide')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
            activeTab === 'userGuide'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          {t('help.userGuideTab')}
        </button>
        <button
          onClick={() => setActiveTab('howItWorks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
            activeTab === 'howItWorks'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          {t('help.howItWorksTab')}
        </button>
      </div>

      {/* FAQ Panel */}
      {activeTab === 'faq' && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-gray-900 font-semibold">{t('help.faqTitle')}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {faqKeys.map((i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between px-6 py-4 text-start hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900 pe-4">
                      {t(`help.faq${i}Q`)}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {t(`help.faq${i}A`)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Glossary Panel */}
      {activeTab === 'glossary' && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-gray-900 font-semibold">{t('help.glossaryTitle')}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {glossaryKeys.map((i) => (
              <div key={i} className="px-6 py-4">
                <dt className="text-sm font-semibold text-gray-900">
                  {t(`help.gl${i}Term`)}
                </dt>
                <dd className="mt-1 text-sm text-gray-600 leading-relaxed">
                  {t(`help.gl${i}Def`)}
                </dd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Guide Panel */}
      {activeTab === 'userGuide' && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-gray-900 font-semibold">{t('help.userGuideTitle')}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {guideKeys.map((i) => (
              <div key={i} className="px-6 py-4">
                <h4 className="text-sm font-semibold text-gray-900">
                  {t(`help.guide${i}Title`)}
                </h4>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  {t(`help.guide${i}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How This Works Panel */}
      {activeTab === 'howItWorks' && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-gray-900 font-semibold">{t('help.howItWorksTitle')}</h3>
          </div>
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-600 leading-relaxed">{t('help.howOverview')}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {howStepKeys.map((i) => (
              <div key={i} className="px-6 py-4">
                <h4 className="text-sm font-semibold text-gray-900">
                  {t(`help.howStep${i}Title`)}
                </h4>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  {t(`help.howStep${i}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
