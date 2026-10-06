import type { Program } from './content-data'

type ProgramCategory = Pick<Program, 'level' | 'sublevel'>

export function getProgramsForIndustry<T extends ProgramCategory>(programs: readonly T[], level: string): T[] {
    return programs.filter((program) => program.level === level)
}

export function getProgramsForDirectIndustry<T extends ProgramCategory>(programs: readonly T[], level: string): T[] {
    return programs.filter((program) => program.level === level && !program.sublevel)
}

export function getProgramsForSublevel<T extends ProgramCategory>(programs: readonly T[], level: string, sublevel: string): T[] {
    return programs.filter((program) => program.level === level && program.sublevel === sublevel)
}
