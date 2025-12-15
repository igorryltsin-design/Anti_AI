import { useState, useEffect } from 'react'
import { Header } from '@/components/Layout/Header'
import { Sidebar } from '@/components/Layout/Sidebar'
import { EditorPage } from '@/pages/EditorPage'
import { BatchPage } from '@/pages/BatchPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useCleaningStore } from '@/store/useCleaningStore'

function App() {
  const [activeTab, setActiveTab] = useState<'editor' | 'batch' | 'settings'>('editor')
  const { theme, currentResult } = useCleaningStore()

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header stats={currentResult?.stats} suspiciousCount={currentResult?.suspiciousRanges.length || 0} />

      <div className="flex">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {activeTab === 'editor' && <EditorPage />}
            {activeTab === 'batch' && <BatchPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
