import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
    activeTab: string
    setActiveTab: (tab: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
    const context = React.useContext(TabsContext)
    if (!context) {
        throw new Error('Tabs components must be used within a Tabs provider')
    }
    return context
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
    defaultValue: string
    value?: string
    onValueChange?: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
    ({ className, defaultValue, value, onValueChange, children, ...props }, ref) => {
        const [activeTab, setActiveTabState] = React.useState(defaultValue)

        const currentTab = value ?? activeTab

        const setActiveTab = React.useCallback((tab: string) => {
            setActiveTabState(tab)
            onValueChange?.(tab)
        }, [onValueChange])

        return (
            <TabsContext.Provider value={{ activeTab: currentTab, setActiveTab }}>
                <div ref={ref} className={cn('', className)} {...props}>
                    {children}
                </div>
            </TabsContext.Provider>
        )
    }
)
Tabs.displayName = 'Tabs'

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'inline-flex items-center justify-center rounded-lg bg-muted p-1',
                className
            )}
            {...props}
        />
    )
)
TabsList.displayName = 'TabsList'

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
    ({ className, value, ...props }, ref) => {
        const { activeTab, setActiveTab } = useTabs()
        const isActive = activeTab === value

        return (
            <button
                ref={ref}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(value)}
                className={cn(
                    'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    'disabled:pointer-events-none disabled:opacity-50',
                    isActive
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    className
                )}
                {...props}
            />
        )
    }
)
TabsTrigger.displayName = 'TabsTrigger'

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
    ({ className, value, ...props }, ref) => {
        const { activeTab } = useTabs()

        if (activeTab !== value) return null

        return (
            <div
                ref={ref}
                role="tabpanel"
                className={cn('mt-2 animate-fade-in', className)}
                {...props}
            />
        )
    }
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
