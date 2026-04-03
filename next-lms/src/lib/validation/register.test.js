import { sanitizeRegisterInput, validateRegisterInput } from './register';

describe('register validation', () => {
    it('sanitizes input values', () => {
        const input = {
            username: '  demo_user  ',
            email: '  USER@EXAMPLE.COM ',
            password: 'Pass1234',
            fullName: '  Demo User ',
            phone: ' 0812345678 ',
        };

        expect(sanitizeRegisterInput(input)).toEqual({
            username: 'demo_user',
            email: 'user@example.com',
            password: 'Pass1234',
            fullName: 'Demo User',
            phone: '0812345678',
        });
    });

    it('accepts valid registration input', () => {
        expect(
            validateRegisterInput({
                username: 'demo_user',
                email: 'demo@example.com',
                password: 'Pass1234',
                fullName: 'Demo User',
                phone: '0812345678',
            })
        ).toEqual({ valid: true, error: '' });
    });

    it('rejects invalid password', () => {
        expect(
            validateRegisterInput({
                username: 'demo_user',
                email: 'demo@example.com',
                password: 'password',
            })
        ).toEqual({
            valid: false,
            error: 'Password must contain both letters and numbers',
        });
    });
});
