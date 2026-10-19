'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { ProjectHeader, ProjectPlaceholder } from '@/components/create/project-header';
import { FindVideo, LinkedVideo, PublishChecklist } from '@/components/create/publish-panel';
import { useCreateConfig } from '@/components/create/use-create-config';
import { useProject } from '@/components/create/use-project';
import { FLOW } from '@/lib/youtube/create/project-state';

export default function PublishPage() {
  const { id } = useParams<{ id: string }>();
  const { config, error: configError } = useCreateConfig();
  const { project, setProject } = useProject(id, !!config?.hasAccess);
  const loaded = project && project !== 'missing' ? project : null;
  const status = loaded?.status === 'ARCHIVED' ? loaded.archivedFrom ?? 'DRAFT' : loaded?.status;
  const rank = status ? FLOW.indexOf(status) : -1;

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <Link href={`/create/${id}/package`} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Packaging
        </Link>

        <AccessGate config={config} error={configError}>
          {!loaded ? (
            <ProjectPlaceholder missing={project === 'missing'} />
          ) : (
            <>
              <ProjectHeader project={loaded} active="publish" />
              {rank < FLOW.indexOf('PACKAGED') ? (
                <section className="card space-y-3">
                  <h2 className="text-xl font-bold text-white">Finish packaging first</h2>
                  <p className="text-base text-zinc-400">Choose a title and thumbnail, then publish the video on YouTube and link it here.</p>
                  <Link href={`/create/${loaded.id}/package`} className="btn-primary btn-sm w-fit">
                    Go to packaging
                  </Link>
                </section>
              ) : rank >= FLOW.indexOf('PUBLISHED') ? (
                <LinkedVideo project={loaded} onUnlinked={setProject} />
              ) : loaded.status === 'ARCHIVED' ? (
                <section className="card text-base text-zinc-300">This project is archived. Restore it to link a video.</section>
              ) : (
                <>
                  <PublishChecklist project={loaded} onProject={setProject} />
                  <FindVideo project={loaded} onLinked={setProject} />
                </>
              )}
            </>
          )}
        </AccessGate>
      </div>
    </div>
  );
}
