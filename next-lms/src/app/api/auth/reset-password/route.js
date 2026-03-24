import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { consumePasswordResetToken, cleanupPasswordResetTokens } from '@/lib/server/password-reset';
import { readJsonBody } from '@/lib/server/request-validation';

export async function POST(request) {
    try {
        const { data: body, response: invalidBodyResponse } = await readJsonBody(request);
        if (invalidBodyResponse) return invalidBodyResponse;

        const token = String(body?.token || '').trim();
        const password = String(body?.password || '');
        const confirmPassword = String(body?.confirmPassword || '');

        if (!token) {
            return NextResponse.json({ error: 'Missing reset token' }, { status: 400 });
        }
        if (!password) {
            return NextResponse.json({ error: 'New password is required' }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }
        if (confirmPassword && password !== confirmPassword) {
            return NextResponse.json({ error: 'Password confirmation does not match' }, { status: 400 });
        }

        const consumed = await consumePasswordResetToken(token);
        if (!consumed?.userId) {
            return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: consumed.userId },
            select: { id: true, status: true },
        });
        if (!user || user.status !== 'active') {
            return NextResponse.json({ error: 'User account is not available' }, { status: 400 });
        }

        const passwordHash = await hashPassword(password);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        await cleanupPasswordResetTokens(user.id);

        return NextResponse.json({
            success: true,
            message: 'Password has been reset successfully',
        });
    } catch (err) {
        console.error('[auth/reset-password] failed', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

