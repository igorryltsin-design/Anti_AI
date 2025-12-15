import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        const variants = {
            default: 'bg-primary text-primary-foreground',
            secondary: 'bg-secondary text-foreground',
            success: 'bg-success text-white',
            warning: 'bg-warning text-black',
            destructive: 'bg-destructive text-white',
            outline: 'border border-border bg-transparent',
        }

        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    variants[variant],
                    className
                )}
                {...props}
            />
        )
    }
)
Badge.displayName = 'Badge'

export { Badge }
