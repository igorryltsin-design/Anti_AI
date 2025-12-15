import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
    ({ className, label, id, ...props }, ref) => {
        const reactId = React.useId()
        const inputId = id || `switch-${reactId}`

        return (
            <div className="flex items-center gap-3">
                <div className="relative inline-flex">
                    <input
                        type="checkbox"
                        id={inputId}
                        ref={ref}
                        className="peer sr-only"
                        {...props}
                    />
                    <div
                        className={cn(
                            'relative h-6 w-11 rounded-full bg-muted transition-colors duration-200',
                            'peer-checked:bg-primary',
                            // Перемещаем ползунок, когда чекбокс активен
                            'peer-checked:[&>div]:translate-x-5',
                            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                            className
                        )}
                    >
                        <div
                            className={cn(
                                'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200',
                                // translate управляется через родительский селектор выше
                            )}
                        />
                    </div>
                    <label
                        htmlFor={inputId}
                        className="absolute inset-0 cursor-pointer peer-disabled:cursor-not-allowed"
                    />
                </div>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-sm font-medium cursor-pointer"
                    >
                        {label}
                    </label>
                )}
            </div>
        )
    }
)
Switch.displayName = 'Switch'

export { Switch }
