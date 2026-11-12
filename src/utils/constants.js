import { A, B, C, D, E, F, G, J, L, Line1, Line2, Line3, Line4, Line5, Line6, Line7, LIRR, LIRR_retro, M, N, Q, R, S, SIR, W, Z, MNR } from "@/components/icons/MtaLines";

export const MTA_SUBWAY_LINE_ICONS = {
    1:  <Line1 />,
    2: <Line2/>,
    3: <Line3 />,
    4: <Line4 />,
    5: <Line5 />,
    6: <Line6 />,
    7: <Line7 />,
    A: <A />,
    B: <B />,
    C: <C/>,
    D: <D />,
    E: <E />,
    F: <F />,
    G: <G />,
    J: <J />,
    L: <L />,
    M: <M />,
    N: <N />,
    Q: <Q />,
    R: <R />,
    S: <S />,
    W: <W />,
    Z: <Z />,
    SIR: <SIR />,
    LIRR: <LIRR />,
    METRONORTH: <MNR />
}

export const ROUTE_ORDER = [
    "A", "C", "E",
    "B", "D", "F", "M",
    "L",
    "N", "Q", "R", "W",
    "J", "Z",
    "1", "2", "3",
    "4", "5", "6",
    "7",
    "G",
    "S",
    "SIR",
    "LIRR",
    "METRONORTH"
  ];

// Shared by HomeSheet's "Get in touch" list and the Legend page's "About" section
export const COMMUNITY_LINKS = [
  { label: "Send feedback", href: "https://app.youform.com/forms/dnefmhvd" },
  { label: "Email the team", href: "mailto:team@transitaccess.org" },
  { label: "Join our Discord", href: "https://discord.gg/HgZVSJ9SE8" },
  { label: "Buy us a coffee", href: "https://www.buymeacoffee.com/transitaccess" },
  { label: "Instagram", href: "https://www.instagram.com/transitaccess/" },
  { label: "TikTok", href: "https://www.tiktok.com/@transitaccess" },
  { label: "Bluesky", href: "https://bsky.app/profile/transitaccess.bsky.social" },
];
  