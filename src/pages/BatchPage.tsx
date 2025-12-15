import { BatchProcessor } from '@/components/BatchMode/BatchProcessor'
import { Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui'
import { useCleaningStore } from '@/store/useCleaningStore'

export function BatchPage() {
    const { detailedSettings } = useCleaningStore()

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
            {/* Main Batch Area */}
            <BatchProcessor />

            {/* Sidebar Info */}
            <div className="space-y-4">
                {/* Quick Stats Card */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Текущие настройки</span>
                        </div>
                        <div className="space-y-2 text-xs text-muted-foreground">
                            <p>• Кавычки: {detailedSettings.quotesDirection === 'toTypographic' ? '" → «»' : '«» → "'}</p>
                            <p>• Тире: {detailedSettings.dashStyle === 'emToEn' ? '— → –' : detailedSettings.dashStyle === 'enToEm' ? '– → —' : 'Все в дефис'}</p>
                            <p className="text-[10px] mt-2">Настройте в разделе "Настройки"</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Tips */}
                <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="text-sm font-medium mb-2">💡 Советы</h3>
                    <ul className="space-y-2 text-xs text-muted-foreground">
                        <li>• Перетащите несколько файлов сразу</li>
                        <li>• Поддерживаются только .docx файлы</li>
                        <li>• Все файлы обрабатываются локально</li>
                        <li>• Скачайте результаты одним архивом</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
