import { ExternalLink } from 'lucide-react';

interface TxHashLinkProps {
  hash: string;
  truncate?: number;
  showIcon?: boolean;
  style?: React.CSSProperties;
}

const ETHERSCAN_BASE = 'https://sepolia.etherscan.io/tx/';

export function TxHashLink({ hash, truncate = 16, showIcon = true, style }: TxHashLinkProps) {
  if (!hash || hash.length < 10) return <span style={style}>{hash || '—'}</span>;

  const display = truncate > 0 && hash.length > truncate
    ? `${hash.slice(0, truncate)}...`
    : hash;

  const isReal = hash.startsWith('0x') && hash.length === 66;

  if (!isReal) {
    return (
      <code style={{
        fontSize: 11.5, color: '#6e6c66',
        fontFamily: '"SF Mono", "Fira Code", monospace',
        letterSpacing: '-0.02em',
        ...style,
      }}>
        {display}
      </code>
    );
  }

  return (
    <a
      href={`${ETHERSCAN_BASE}${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11.5, color: '#1d4ed8', textDecoration: 'none',
        fontFamily: '"SF Mono", "Fira Code", monospace',
        letterSpacing: '-0.02em',
        ...style,
      }}
      title="View on Etherscan (Sepolia)"
    >
      {display}
      {showIcon && <ExternalLink style={{ width: 11, height: 11, opacity: 0.7 }} />}
    </a>
  );
}
