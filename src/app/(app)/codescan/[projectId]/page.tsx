'use client';
import { use } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { ProjectPillarTabs } from '@/components/layout/ProjectPillarTabs';
import { CodeScanPanel } from '@/components/codescan/CodeScanPanel';

export default function CodeScanPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <>
      <TopNav />
      <ProjectPillarTabs projectId={projectId} active="codescan" />
      <main className="flex-1 px-6 py-4 overflow-hidden">
        <CodeScanPanel projectId={projectId} />
      </main>
    </>
  );
}
