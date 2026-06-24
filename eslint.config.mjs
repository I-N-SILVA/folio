import next from 'eslint-config-next'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'

// eslint-config-next ships a native flat-config array (Next 15.3+), so we spread
// it directly rather than going through FlatCompat — that combination trips a
// circular-structure bug in @eslint/eslintrc under ESLint 9.
const eslintConfig = [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'next-env.d.ts', 'data/**', 'public/**'],
  },
  ...next,
  {
    // Adoption baseline: keep CI green on the existing tree while still
    // surfacing these. The react-hooks v6 rules below are new and heuristic
    // (effects, purity, refs); `no-unescaped-entities` is purely cosmetic.
    // Demote them to warnings now and tighten incrementally.
    plugins: { 'react-hooks': reactHooks, react },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
]

export default eslintConfig
