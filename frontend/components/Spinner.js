export default function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className={`inline-block ${className}`}>
      <div className={`${sizeClasses[size]} border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
    </div>
  );
}
