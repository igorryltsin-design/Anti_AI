import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
    size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

        const variants = {
            default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg',
            secondary: 'bg-secondary text-foreground hover:bg-secondary/80',
            outline: 'border border-border bg-transparent hover:bg-muted',
            ghost: 'hover:bg-muted',
            destructive: 'bg-destructive text-white hover:bg-destructive/90',
        }

        const sizes = {
            default: 'h-10 px-4 py-2 text-sm',
            sm: 'h-8 px-3 text-xs',
            lg: 'h-12 px-6 text-base',
            icon: 'h-10 w-10',
        }

        return (
            <button
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'

export { Button }
