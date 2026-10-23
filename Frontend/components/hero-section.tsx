import { Sparkles } from 'lucide-react'

type HeroSectionProps = {
    onNavigate: (path: string) => void
}

export function HeroSection({ onNavigate }: HeroSectionProps) {
    return (
        <section id="overview" className="hero-section">
            <div className="hero-pattern" aria-hidden="true" />
            <div className="hero-content">
                <div className="eyebrow">
                    <span className="eyebrow-line" /> <Sparkles size={14} /> Kho lưu trữ giáo án và chương trình học 
                </div>
                <h1>
                    Cùng nhau lớn lên
                    <br />
                    <em>trong đức tin</em>
                </h1>
                <p className="hero-copy">
                    Nơi lưu trữ và chia sẻ giáo án, chương trình học giáo lý dành cho các anh chị giáo lý viên.
                </p>
                <div className="hero-actions">
                    <button className="primary-button" onClick={() => onNavigate('/lesson-plans')}>
                        Khám phá giáo án
                    </button>
                    <button className="text-button" onClick={() => onNavigate('/programs')}>
                        Xem chương trình học
                    </button>
                </div>
                <div className="hero-note">
                    <span className="cross-small">✠</span> "Hãy để trẻ em đến với Thầy" <span>— Mt 19,14</span>
                </div>
            </div>
            <div className="hero-illustration" aria-hidden="true">
                <img className="hero-stained-glass-image" src="/images/stained-glass-hero-expanded.png" alt="" />
                <span className="hero-canopy-shadows" />
            </div>
        </section>
    )
}
