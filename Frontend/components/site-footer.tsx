'use client'

import { Church } from 'lucide-react'

export function SiteFooter() {
    return (
        <footer>
            <div className="footer-brand">
                <span className="brand-mark">
                    <Church size={18} />
                </span>
                <span>
                    <strong>Giáo Phận Xuân Lộc</strong>
                    <small>Giáo xứ Thái An</small>
                </span>
            </div>
            <p>Góp phần xây dựng một thế hệ trẻ sống đức tin và yêu mến Giáo Hội.</p>
            <span className="footer-copy">© 2025 Giáo lý Công giáo</span>
        </footer>
    )
}
