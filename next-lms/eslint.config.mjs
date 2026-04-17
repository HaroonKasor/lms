import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
    ...nextVitals.map((entry) => {
        const hasNextPlugin = Boolean(entry?.plugins?.['@next/next']);
        const hasReactPlugin = Boolean(entry?.plugins?.react);
        const hasReactHooksPlugin = Boolean(entry?.plugins?.['react-hooks']);
        if (!hasNextPlugin && !hasReactPlugin && !hasReactHooksPlugin) return entry;
        return {
            ...entry,
            rules: {
                ...entry.rules,
                ...(hasNextPlugin ? { '@next/next/no-img-element': 'off' } : {}),
                ...(hasReactHooksPlugin ? { 'react-hooks/set-state-in-effect': 'warn' } : {}),
                ...(hasReactPlugin ? { 'react/no-unescaped-entities': 'off' } : {}),
            },
        };
    }),
    {
        ignores: [
            'public/content/**',
            'scripts/**',
            'src/generated/**',
        ],
    },
];

export default config;
