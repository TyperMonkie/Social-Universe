import Image from "next/image";
import styles from "./FrogCharacter.module.css";

export type FrogAccessory = "guitar" | "camera" | "ball" | "microphone" | "book";

export type FrogCharacterProps = {
  accessories?: FrogAccessory[];
  badge?: string;
  className?: string;
};

const accessoryNames: Record<FrogAccessory, string> = {
  guitar: "吉他",
  camera: "相机",
  ball: "小球",
  microphone: "麦克风",
  book: "书",
};

function AccessoryArt({ type }: { type: FrogAccessory }) {
  switch (type) {
    case "guitar":
      return (
        <svg viewBox="0 0 64 80" aria-hidden="true">
          <defs><linearGradient id="frog-guitar" x2="1" y2="1"><stop stopColor="#f7c778" /><stop offset="1" stopColor="#bd6f45" /></linearGradient></defs>
          <g transform="rotate(29 32 40)" stroke="#573d40" strokeWidth="2" strokeLinejoin="round">
            <rect x="28" y="5" width="8" height="43" rx="3" fill="#74515a" />
            <rect x="27" y="2" width="10" height="10" rx="2" fill="#987273" />
            <path d="M23 36C11 34 9 44 14 50c-8 13-2 25 18 25s26-12 18-25c5-6 3-16-9-14-4 2-6 6-9 6s-5-4-9-6Z" fill="url(#frog-guitar)" />
            <circle cx="32" cy="52" r="6" fill="#5c3d46" />
            <path d="M30 8v62M32 8v62M34 8v62" stroke="#f8dfb0" strokeWidth=".7" />
            <path d="M21 60h22" stroke="#5f4248" strokeWidth="3" />
          </g>
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <defs><linearGradient id="frog-camera" x2="1" y2="1"><stop stopColor="#a5dce5" /><stop offset="1" stopColor="#467a98" /></linearGradient></defs>
          <g stroke="#29475a" strokeWidth="2.5" strokeLinejoin="round">
            <path d="M9 20h10l5-7h16l5 7h10a4 4 0 0 1 4 4v27a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4Z" fill="url(#frog-camera)" />
            <circle cx="32" cy="36" r="13" fill="#163e55" stroke="#d9f4ed" />
            <circle cx="32" cy="36" r="8" fill="#5e91ad" stroke="#174764" />
            <circle cx="29" cy="33" r="2.5" fill="#e7fff8" stroke="none" />
            <circle cx="51" cy="26" r="2" fill="#f8dd9a" stroke="none" />
          </g>
        </svg>
      );
    case "ball":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <defs><radialGradient id="frog-ball" cx="35%" cy="28%"><stop stopColor="#ffe1a3" /><stop offset=".55" stopColor="#efa164" /><stop offset="1" stopColor="#b86266" /></radialGradient></defs>
          <circle cx="32" cy="32" r="26" fill="url(#frog-ball)" stroke="#844f65" strokeWidth="2" />
          <path d="M11 17c12 3 18 15 19 39M27 7c5 10 15 15 30 15M57 39c-15-1-24 5-28 17" fill="none" stroke="#fff3c7" strokeWidth="2.5" opacity=".8" />
          <circle cx="22" cy="20" r="6" fill="#fff8d4" opacity=".38" />
        </svg>
      );
    case "microphone":
      return (
        <svg viewBox="0 0 64 72" aria-hidden="true">
          <defs><linearGradient id="frog-mic" x2="1" y2="1"><stop stopColor="#f8f6ef" /><stop offset="1" stopColor="#7b9ca9" /></linearGradient></defs>
          <g stroke="#41586a" strokeWidth="2" strokeLinejoin="round">
            <rect x="19" y="5" width="26" height="32" rx="13" fill="url(#frog-mic)" />
            <path d="M14 27v6a18 18 0 0 0 36 0v-6" fill="none" strokeWidth="4" />
            <path d="M32 51v13M21 65h22" fill="none" strokeWidth="4" strokeLinecap="round" />
            <path d="M22 19h20M22 25h20M24 31h16" opacity=".45" />
          </g>
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <g stroke="#345961" strokeWidth="2" strokeLinejoin="round">
            <path d="M7 13c9-4 18-4 25 1v42c-8-5-16-5-25-1V13Z" fill="#98d5c8" />
            <path d="M57 13c-9-4-18-4-25 1v42c8-5 16-5 25-1V13Z" fill="#d2e9cd" />
            <path d="M32 14v42" fill="none" />
            <path d="M13 23c5-2 9-2 13 0M13 30c5-2 9-2 13 0M38 23c5-2 9-2 13 0M38 30c5-2 9-2 13 0" fill="none" opacity=".55" />
            <path d="M47 12v13l-4-3-4 3V12" fill="#f5af91" />
          </g>
        </svg>
      );
  }
}

/** A transparent, camera-facing character layer for the scene's 3D anchor. */
export default function FrogCharacter({ accessories = [], badge, className = "" }: FrogCharacterProps) {
  const visibleAccessories = accessories.slice(0, 2).filter((item): item is FrogAccessory => item in accessoryNames);
  const badgeText = badge?.trim().slice(0, 20);

  return (
    <div className={`${styles.character} ${className}`} aria-label="黄色奶蛙角色">
      <div className={styles.figure}>
        <Image
          src="/characters/nai-frog.png"
          width={474}
          height={472}
          alt="黄色奶蛙仰头大笑，奶油色肚皮"
          className={styles.portrait}
          draggable={false}
        />
        {visibleAccessories.map((item, index) => (
          <span
            className={`${styles.accessory} ${styles[item]} ${index === 0 ? styles.first : styles.second}`}
            key={`${item}-${index}`}
            role="img"
            aria-label={accessoryNames[item]}
          >
            <AccessoryArt type={item} />
          </span>
        ))}
      </div>
      {badgeText && <span className={styles.badge}>{badgeText}</span>}
    </div>
  );
}
