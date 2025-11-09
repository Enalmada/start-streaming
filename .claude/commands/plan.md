# Plan

Create a planning document for a complex feature before implementation.

## Usage
Simply say: **"Plan this feature"** and paste the file path

**Two modes:**
1. If given a specific `.md` file (e.g., `01b-feature.md`): Expand that file in place
2. If given a directory: Create `README.md` in that directory

## Conventions

### Input
- File path to existing problem statement/brief (will be expanded in place)
- OR directory path (will create README.md)

### Output
- **If given .md file**: Expand that file with full plan structure
- **If given directory**: Create lean README.md at `.plan/plans/<directory-name>/README.md`
- **Supporting**: Detailed research files in same directory (e.g., `research.md`, `analysis.md`)
- Strip `feature/`, `hotfix/` prefixes from directory name

### Task-Specific Plan Structure (When expanding .md files)

**Problem Statement**
- Preserve original problem description
- Add any clarifications needed

**Current State**
- What exists today
- What's broken or missing
- File references with line numbers

**Target State**
- What should exist after implementation
- Clear success criteria

**Technical Decisions**
- Evaluate options (use "ultrathink" for deep analysis)
- Justify chosen approach
- Document alternatives considered

**Implementation Plan**
- Phases with specific file changes
- Code patterns to use
- Edge cases to handle

**Testing Strategy**
- Unit tests, Storybook, E2E tests
- Manual testing checklist

**Implementation Tasks**
- Checkbox format for tracking
- Break down by: Foundation → Core → Testing → Polish
- Specific, actionable tasks

**Key Files Reference**
- List all relevant files with paths

**Future Enhancements** (optional)
- Ideas for later iterations

**Success Criteria**
- Measurable outcomes

### README.md Structure (Keep Lean)

**Problem Summary**
- Brief 2-3 sentence summary of what needs to be solved
- Links to detailed research files if needed

**Resources**
- Key codebase files (list paths only)
- Relevant documentation links
- Link to detailed research: `[See research.md](./research.md)`

**Plan** (Ultrathink-based)
- **CRITICAL**: Use "ultrathink" to trigger maximum thinking depth
- High-level approach and key decisions
- Major phases or milestones
- Keep concise - detailed analysis goes in separate files

**Tasks**
- Checkbox format for tracking
- Break down into phases: Foundation → Core → Testing (Vitest, storybook, playwright)
- Specific, actionable tasks
- Update as tasks are completed

### Supporting Files (Detailed Research)

Create separate files in `.plan/plans/<directory-name>/` for detailed content.
The plan should be the lean status tracking document pointing to more detailed research files.

### What NOT to Include
- Implementation instructions for anything obvious Claude Code can do
- Detailed bash scripts
- Step-by-step tutorials

This is a **planning document only** - it doesn't implement the feature. Use `/pr` after implementation.
