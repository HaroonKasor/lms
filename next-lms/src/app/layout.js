import { Outfit } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import IdleSessionGuard from "@/components/layout/IdleSessionGuard";

const outfit = Outfit({
    subsets: ["latin"],
    variable: "--font-outfit",
});

const thSarabun = localFont({
    src: [
        {
            path: "./fonts/thsarabunnew-webfont.ttf",
            weight: "400",
            style: "normal",
        },
        {
            path: "./fonts/thsarabunnew_bold-webfont.ttf",
            weight: "700",
            style: "normal",
        },
    ],
    variable: "--font-th-sarabun",
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
            <body className={`${outfit.variable} ${thSarabun.variable} bg-gradient-to-b from-[#FFFFFF] to-[#F6F8FF] min-h-screen text-gray-800`}>
                <IdleSessionGuard />
                {children}
            </body>
        </html>
    );
}

