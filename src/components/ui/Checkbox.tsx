import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    description?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, description, id, ...props }, ref) => {
        const reactId = React.useId()
        const inputId = id || `checkbox-${reactId}`

        return (
            <div className="flex items-start gap-3">
                <div className="relative flex items-center">
                    <input
                        type="checkbox"
                        id={inputId}
                        ref={ref}
                        className="peer sr-only"
                        {...props}
                    />
                    <div
                        className={cn(
                            'h-5 w-5 rounded-md border border-border bg-background transition-all duration-200',
                            'peer-checked:border-primary peer-checked:bg-primary',
                            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                            className
                        )}
                    >
                        <Check
                            className="h-4 w-4 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100 absolute top-0.5 left-0.5"
                            strokeWidth={3}
                        />
                    </div>
                    <label
                        htmlFor={inputId}
                        className="absolute inset-0 cursor-pointer peer-disabled:cursor-not-allowed"
                    />
                </div>
                {(label || description) && (
                    <div className="flex flex-col">
                        {label && (
                            <label
                                htmlFor={inputId}
                                className="text-sm font-medium cursor-pointer peer-disabled:cursor-not-allowed"
                            >
                                {label}
                            </label>
                        )}
                        {description && (
                            <span className="text-xs text-muted-foreground">{description}</span>
                        )}
                    </div>
                )}
            </div>
        )
    }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
