import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  return (
    <div className={`flex items-center gap-2 font-extrabold select-none ${className}`}>
      {/* 텍스트 로고용 컴포넌트입니다. 이미지를 쓸 때는 이 컴포넌트 대신 img 태그를 쓰기도 합니다 */}
      <span className={`${sizeClasses[size]} animate-bounce-slow`}>✈️</span>
      <h1 
        className={`
          ${sizeClasses[size]} 
          bg-clip-text text-transparent 
          bg-gradient-to-r from-blue-600 via-purple-500 to-teal-400
          tracking-tight
        `}
      >
        Holiday Hub
      </h1>
    </div>
  );
};