import "./globals.css";
import IdleSessionGuard from "@/components/layout/IdleSessionGuard";
import GlobalToastProvider from "@/components/ui/GlobalToastProvider";
import PageTransition from "@/components/ui/PageTransition";

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
            <body className="bg-gradient-to-b from-[#FFFFFF] to-[#F6F8FF] min-h-screen text-gray-800">
                <IdleSessionGuard />
                <GlobalToastProvider />
                <PageTransition>{children}</PageTransition>
            </body>
        </html>
    );
}

