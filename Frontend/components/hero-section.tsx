import { ArrowRight, Church, Sparkles } from 'lucide-react'

type HeroSectionProps = {
    onNavigate: (path: string) => void
}

export function HeroSection({ onNavigate }: HeroSectionProps) {
    return (
        <section id="overview" className="hero-section">
            <div className="hero-pattern" aria-hidden="true" />
            <div className="hero-content">
                <div className="eyebrow">
                    <span className="eyebrow-line" /> <Sparkles size={14} /> Kho tài liệu giáo lý Công giáo
                </div>
                <h1>
                    Cùng nhau lớn lên
                    <br />
                    <em>trong đức tin</em>
                </h1>
                <p className="hero-copy">
                    Nơi lưu trữ và chia sẻ giáo án, chương trình học giáo lý dành cho các bạn thiếu nhi và anh chị giáo lý viên.
                </p>
                <div className="hero-actions">
                    <button className="primary-button" onClick={() => onNavigate('/lesson-plans')}>
                        Khám phá giáo án <ArrowRight size={17} />
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
                <div className="sun-disc" />
                <div className="stained-glass">
                    <span /><span /><span /><span /><span /><span /><span /><span /><i />
                </div>
                <div className="cross-ornament">✠</div>
            </div>
        </section>
    )
}
