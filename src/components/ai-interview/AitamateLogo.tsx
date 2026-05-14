import React from 'react';

const AitamateLogo = ({ size = 'default', showTagline = true, className = '', variant = 'default' }) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    default: 'w-12 h-12',
    large: 'w-16 h-16',
    xlarge: 'w-20 h-20'
  };

  const textSizes = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl'
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Logo Image */}
      <img 
        src={`${import.meta.env.BASE_URL}assets/Logo-transparent_bg.png`} 
        alt="Aitamate Logo" 
        className={`${sizeClasses[size]} object-contain`}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          console.error('Logo image failed to load:', target.src);
          // Fallback to text-only if image fails
          target.style.display = 'none';
        }}
      />
    </div>
  );
};

export default AitamateLogo;
