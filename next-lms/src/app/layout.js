import { Noto_Sans_Thai, Outfit } from "next/font/google";
import "./globals.css";
import IdleSessionGuard from "@/components/layout/IdleSessionGuard";
import GlobalToastProvider from "@/components/ui/GlobalToastProvider";

const outfit = Outfit({
    subsets: ["latin"],
    variable: "--font-outfit",
});

const notoSansThai = Noto_Sans_Thai({
    subsets: ["thai", "latin"],
    weight: ["300", "400", "500", "600", "700", "800"],
    variable: "--font-noto-sans-thai",
    display: "swap",
});

export const metadata = {
    title: "SkillUp",
    description: "SkillUp Learning Platform",
    icons: {
        icon: "/skillup_logo.png",
        shortcut: "/skillup_logo.png",
        apple: "/skillup_logo.png",
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className={`${outfit.variable} ${notoSansThai.variable} bg-gradient-to-b from-[#FFFFFF] to-[#F6F8FF] min-h-screen text-gray-800`}>
                <IdleSessionGuard />
                <GlobalToastProvider />
                {children}
            </body>
        </html>
    );
}

