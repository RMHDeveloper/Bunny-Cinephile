import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = `py-3 px-6 rounded-lg font-bold transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-opacity-75`;

  const primaryStyles = `bg-neon-blue text-deep-navy border border-neon-blue shadow-lg shadow-neon-blue/40
                        hover:bg-opacity-80 hover:shadow-neon-blue/60
                        disabled:bg-gray-700 disabled:text-gray-400 disabled:border-gray-500 disabled:shadow-none disabled:cursor-not-allowed`;

  const secondaryStyles = `bg-transparent text-neon-blue border border-neon-blue shadow-lg shadow-neon-blue/20
                         hover:bg-neon-blue hover:text-deep-navy hover:shadow-neon-blue/40
                         disabled:text-gray-500 disabled:border-gray-600 disabled:shadow-none disabled:cursor-not-allowed`;

  const selectedStyles = variant === 'primary' ? primaryStyles : secondaryStyles;

  return (
    <button
      className={`${baseStyles} ${selectedStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
          <span className="ml-2">Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;