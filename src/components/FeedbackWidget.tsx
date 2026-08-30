import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, ArrowLeft, Bug, Lightbulb, HelpCircle, Paperclip, FileText, Image, Video, Send } from 'lucide-react';
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

  const options: { id: View; icon: any; label: string; desc: string; iconBg: string; iconColor: string }[] = [
    { id: 'bug', icon: Bug, label: t('feedback.reportBug'), desc: t('feedback.bugDesc'), iconBg: '#fef2f2', iconColor: '#dc2626' },
    { id: 'feature', icon: Lightbulb, label: t('feedback.requestFeature'), desc: t('feedback.featureDesc'), iconBg: '#fffbeb', iconColor: '#d97706' },
    { id: 'question', icon: HelpCircle, label: t('feedback.askQuestion'), desc: t('feedback.questionDesc'), iconBg: '#eff6ff', iconColor: '#2563eb' },
  ];

  const viewConfig: Record<Exclude<View, 'menu'>, { title: string; iconBg: string; iconColor: string; icon: any }> = {
    bug: { title: t('feedback.reportBug'), iconBg: '#fef2f2', iconColor: '#dc2626', icon: Bug },
    feature: { title: t('feedback.requestFeature'), iconBg: '#fffbeb', iconColor: '#d97706', icon: Lightbulb },
    question: { title: t('feedback.askQuestion'), iconBg: '#eff6ff', iconColor: '#2563eb', icon: HelpCircle },
  };

  return createPortal(
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('feedback.title')}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '11px 22px', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #0f2942 0%, #173d61 100%)',
          color: '#fff', borderRadius: 14,
          boxShadow: '0 4px 16px rgba(15, 41, 66, 0.35)',
          display: 'flex', alignItems: 'center', gap: 9,
          transition: 'all .2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(15, 41, 66, 0.45)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(15, 41, 66, 0.35)'; }}
      >
        {isOpen ? <X style={{ width: 18, height: 18 }} /> : <MessageSquare style={{ width: 18, height: 18 }} />}
        <span style={{ fontSize: 14, fontWeight: 700 }}>{t('feedback.button')}</span>
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

          <div style={{
            position: 'fixed', bottom: 80, right: 24, zIndex: 9999,
            width: 380, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
            background: '#fff', borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,.15), 0 0 0 1px rgba(0,0,0,.05)',
            animation: 'feedbackSlideUp .25s ease-out',
          }}>
            {/* Success state */}
            {submitted ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#0f2942' }}>{t('feedback.thankYou')}</h3>
                <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{t('feedback.thankYouMsg')}</p>
              </div>
            ) : view === 'menu' ? (
              /* Main Menu */
              <>
                {/* Header with accent bar */}
                <div style={{
                  padding: '22px 24px 18px',
                  background: 'linear-gradient(135deg, #0f2942 0%, #173d61 100%)',
                  borderRadius: '16px 16px 0 0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(201, 154, 60, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MessageSquare style={{ width: 18, height: 18, color: '#e0b658' }} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>{t('feedback.title')}</h2>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>{t('feedback.subtitle')}</p>
                    </div>
                  </div>
                </div>

                {/* Menu options */}
                <div style={{ padding: '16px 16px 20px' }}>
                  {options.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setView(opt.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 16px', borderRadius: 12, border: '1.5px solid #f0f0f0',
                          background: '#fff', cursor: 'pointer', textAlign: 'start',
                          marginBottom: opt.id === 'question' ? 0 : 10,
                          transition: 'all .15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#c99a3c';
                          e.currentTarget.style.background = '#fefcf7';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#f0f0f0';
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: opt.iconBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Icon style={{ width: 20, height: 20, color: opt.iconColor }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 650, color: '#0f2942' }}>{opt.label}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c99a3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Form View */
              <>
                {/* Form header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <button
                    onClick={goBack}
                    aria-label={t('feedback.back')}
                    style={{
                      border: 'none', background: '#f3f4f6', cursor: 'pointer',
                      padding: 6, borderRadius: 8, display: 'flex',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                  >
                    <ArrowLeft style={{ width: 16, height: 16, color: '#374151' }} />
                  </button>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: viewConfig[view].iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {(() => { const Icon = viewConfig[view].icon; return <Icon style={{ width: 16, height: 16, color: viewConfig[view].iconColor }} />; })()}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f2942' }}>{viewConfig[view].title}</h2>
                </div>

                {/* Form body */}
                <div style={{ padding: '20px 20px 24px' }}>
                  <div style={{ marginBottom: 16 }}>
                    <label htmlFor="feedback-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      {t('feedback.emailLabel')}
                    </label>
                    <input
                      id="feedback-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('feedback.emailPlaceholder')}
                      style={{
                        width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                        borderRadius: 10, fontSize: 13, color: '#0f2942',
                        outline: 'none', transition: 'border-color .15s',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#c99a3c'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label htmlFor="feedback-message" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      {t('feedback.messageLabel')}
                    </label>
                    <textarea
                      id="feedback-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t('feedback.messagePlaceholder')}
                      rows={4}
                      style={{
                        width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                        borderRadius: 10, fontSize: 13, color: '#0f2942',
                        outline: 'none', resize: 'none', transition: 'border-color .15s',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#c99a3c'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                    />
                  </div>

                  {/* Attachment section — only for bug reports */}
                  {view === 'bug' && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
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
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px', background: '#ecfdf5', border: '1.5px solid #a7f3d0',
                          borderRadius: 10, fontSize: 13, color: '#059669',
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span style={{ flex: 1 }}>{attachments.length} {attachments.length === 1 ? t('feedback.fileAttached') : t('feedback.filesAttached')}</span>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#2563eb', fontWeight: 600, flexShrink: 0 }}
                          >
                            + {t('feedback.addMore')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            width: '100%', padding: '10px 14px',
                            border: '1.5px dashed #d1d5db', borderRadius: 10,
                            background: '#fafafa', fontSize: 13, color: '#6b7280',
                            cursor: 'pointer', transition: 'all .15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c99a3c'; e.currentTarget.style.color = '#c99a3c'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; }}
                        >
                          <Paperclip style={{ width: 15, height: 15 }} />
                          {t('feedback.attachFile')}
                        </button>
                      )}
                      {attachments.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {attachments.map((file, i) => {
                            const Icon = getFileIcon(file);
                            return (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '6px 10px', background: '#f9fafb', borderRadius: 8,
                                fontSize: 12, color: '#374151',
                              }}>
                                <Icon style={{ width: 14, height: 14, color: '#6b7280', flexShrink: 0 }} />
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                <span style={{ color: '#9ca3af', flexShrink: 0 }}>{formatFileSize(file.size)}</span>
                                <button
                                  onClick={() => removeAttachment(i)}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 4 }}
                                  aria-label={t('feedback.removeFile')}
                                >
                                  <X style={{ width: 12, height: 12, color: '#9ca3af' }} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!email || !message}
                    style={{
                      width: '100%', padding: '12px 20px', border: 'none', borderRadius: 10,
                      background: (!email || !message) ? '#e5e7eb' : 'linear-gradient(135deg, #0f2942 0%, #173d61 100%)',
                      color: (!email || !message) ? '#9ca3af' : '#fff',
                      fontSize: 14, fontWeight: 700, cursor: (!email || !message) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'all .15s',
                    }}
                    onMouseEnter={(e) => { if (email && message) e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <Send style={{ width: 15, height: 15 }} />
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
