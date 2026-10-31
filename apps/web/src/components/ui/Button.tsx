import './Button.css';
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'secondary' | 'ghost';

interface BaseProps {
  variant?: Variant;
  size?: 'md' | 'sm';
  className?: string;
}

function classes({ variant = 'primary', size = 'md', className = '' }: BaseProps): string {
  return ['btn', `btn--${variant}`, size === 'sm' ? 'btn--sm' : '', className].filter(Boolean).join(' ');
}

export function Button({ variant, size, className, type = 'button', ...rest }: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes({ variant, size, className })} {...rest} />;
}

export function ButtonLink({ variant, size, className, ...rest }: BaseProps & LinkProps) {
  return <Link className={classes({ variant, size, className })} {...rest} />;
}
