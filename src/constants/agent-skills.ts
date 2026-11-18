/**
 * Agent skills: what `init` installs with `npx skills add`
 */

/** The tsdevstack skills, from their public repo */
export const TSDEVSTACK_SKILLS_SOURCE = 'tsdevstack/skills';

/**
 * Third-party skills installed after the tsdevstack ones: the `install` list
 * of `skills/curation.json` in the framework repo (keep the two in step).
 * Each source is the skill's SKILL.md at a fixed commit of its author's repo,
 * which `npx skills add` downloads as one file. A commit pin written as
 * `owner/repo@<commit>` would make the skills CLI clone that whole commit
 * (about 160 MB for Next.js).
 */
export const CURATED_AGENT_SKILLS = [
  {
    name: 'next-dev-loop',
    source:
      'https://raw.githubusercontent.com/vercel/next.js/d2defa02a2887f94b99a573cf17efbef112218fd/skills/next-dev-loop/SKILL.md',
    /** Printed after the install: what the skill needs on the machine */
    needs: 'next-dev-loop needs agent-browser: npm i -g agent-browser',
  },
] as const;
