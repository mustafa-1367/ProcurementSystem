import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, ArrowLeft, Bug, Lightbulb, HelpCircle, Paperclip, FileText, Image, Video } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

type View = 'menu' | 'bug' | 'feature' | 'question';

export function FeedbackWidget() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('menu');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAndClose = () => {
    setIsOpen(false);
    setView('menu');
    setEmail('');
    setMessage('');
    setSubmitted(false);
    setAttachments([]);
  };

  const goBack = () => {
    setView('menu');
    setEmail('');
    setMessage('');
    setSubmitted(false);
    setAttachments([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
    // Reset so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.startsWith('video/')) return Video;
    return FileText;
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      resetAndClose();
    }, 2000);
  };

  const options = [
    { id: 'bug' as View, icon: Bug, label: t('feedback.reportBug') },
    { id: 'feature' as View, icon: Lightbulb, label: t('feedback.requestFeature') },
    { id: 'question' as View, icon: HelpCircle, label: t('feedback.askQuestion') },
  ];

  const viewTitle: Record<Exclude<View, 'menu'>, string> = {
    bug: t('feedback.reportBug'),
    feature: t('feedback.requestFeature'),
    question: t('feedback.askQuestion'),
  };

  return createPortal(
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('feedback.title')}
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, padding: '10px 20px' }}
        className="flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        <span className="text-base font-semibold">{t('feedback.button')}</span>
      </button>

      {/* Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            aria-hidden="true"
            onClick={resetAndClose}
          />

          <div
            style={{ position: 'fixed', bottom: '80px', right: '24px', zIndex: 9999, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}
            className="w-96 bg-white rounded-xl shadow-2xl border border-gray-200"
          >
            {/* Success state */}
            {submitted ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-gray-900 font-semibold text-lg">{t('feedback.thankYou')}</h3>
                <p className="text-gray-600 text-sm mt-1">{t('feedback.thankYouMsg')}</p>
              </div>
            ) : view === 'menu' ? (
              /* Main Menu */
              <>
                <div className="px-6 py-5 border-b border-gray-200">
                  <h2 className="text-gray-900 text-lg font-semibold">{t('feedback.title')}</h2>
                  <p className="text-gray-600 text-sm mt-1">{t('feedback.subtitle')}</p>
                </div>
                <div className="p-4 space-y-2">
                  {options.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setView(opt.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors text-start focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Icon className="w-5 h-5 text-blue-600 shrink-0" />
                        <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Form View */
              <>
                <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
                  <button
                    onClick={goBack}
                    aria-label={t('feedback.back')}
                    className="p-1 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-700" />
                  </button>
                  <h2 className="text-gray-900 font-semibold">{t('feedback.title')}</h2>
                </div>
                <div className="p-6 space-y-4">
                  <h3 className="text-gray-900 font-semibold">{viewTitle[view]}</h3>

                  <div>
                    <label htmlFor="feedback-email" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('feedback.emailLabel')}
                    </label>
                    <input
                      id="feedback-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('feedback.emailPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('feedback.messageLabel')}
                    </label>
                    <textarea
                      id="feedback-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t('feedback.messagePlaceholder')}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Attachment section — only for bug reports */}
                  {view === 'bug' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('feedback.attachments')}
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.log,.txt"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      {attachments.length > 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="flex-1">{attachments.length} {attachments.length === 1 ? t('feedback.fileAttached') : t('feedback.filesAttached')}</span>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
                          >
                            + {t('feedback.addMore')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
                        >
                          <Paperclip className="w-4 h-4" />
                          {t('feedback.attachFile')}
                        </button>
                      )}
                      {attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {attachments.map((file, i) => {
                            const Icon = getFileIcon(file);
                            return (
                              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-md text-xs text-gray-700">
                                <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                <span className="truncate flex-1">{file.name}</span>
                                <span className="text-gray-400 shrink-0">{formatFileSize(file.size)}</span>
                                <button
                                  onClick={() => removeAttachment(i)}
                                  className="p-0.5 hover:bg-gray-200 rounded transition-colors shrink-0"
                                  aria-label={t('feedback.removeFile')}
                                >
                                  <X className="w-3 h-3 text-gray-500" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!email || !message}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {t('feedback.send')}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>,
    document.body
  );
}
