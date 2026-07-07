import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import Grid from '@cloudscape-design/components/grid';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Badge from '@cloudscape-design/components/badge';
import Icon, { type IconProps } from '@cloudscape-design/components/icon';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import TextFilter from '@cloudscape-design/components/text-filter';
import WorkbenchTopBar from '../components/WorkbenchTopBar';
import { getApps } from '../lib/api';
import type { WorkbenchApp } from '../types';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<WorkbenchApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    let active = true;
    getApps()
      .then((data) => active && setApps(data))
      .catch((err: unknown) =>
        active &&
        setError(err instanceof Error ? err.message : 'Failed to load applications'),
      );
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!apps) return [];
    if (!q) return apps;
    return apps.filter((a) =>
      [a.name, a.shortName, a.category, a.description].some((s) =>
        s.toLowerCase().includes(q),
      ),
    );
  }, [apps, filterText]);

  const openApp = (app: WorkbenchApp) => {
    if (app.status === 'available') navigate(app.route);
  };

  return (
    <>
      <WorkbenchTopBar />
      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header
              variant="h1"
              description="Select an application to open it in the workbench."
            >
              Applications
            </Header>
          </Box>
        }
      >
        <Box padding={{ horizontal: 'l', bottom: 'xxl' }}>
          <SpaceBetween size="l">
            {/* Search bar */}
            <div style={{ maxWidth: 480 }}>
              <TextFilter
                filteringText={filterText}
                filteringPlaceholder="Find an application"
                filteringAriaLabel="Find an application"
                countText={
                  filterText
                    ? `${filtered.length} ${filtered.length === 1 ? 'match' : 'matches'}`
                    : ''
                }
                onChange={({ detail }) => setFilterText(detail.filteringText)}
              />
            </div>

            {error ? (
              <Alert type="error" header="Could not load applications">
                {error}
              </Alert>
            ) : !apps ? (
              <Box textAlign="center" padding="xxl">
                <Spinner size="large" />
              </Box>
            ) : filtered.length === 0 ? (
              <Box textAlign="center" padding="xxl" color="text-body-secondary">
                <SpaceBetween size="s">
                  <Box variant="strong">No applications found</Box>
                  <span>
                    No applications match “{filterText}”.
                  </span>
                  <div>
                    <Button onClick={() => setFilterText('')}>Clear search</Button>
                  </div>
                </SpaceBetween>
              </Box>
            ) : (
              <Grid
                gridDefinition={filtered.map(() => ({
                  colspan: { default: 12, xs: 6, s: 6 },
                }))}
              >
                {filtered.map((app) => {
                  const available = app.status === 'available';
                  return (
                    <div
                      key={app.id}
                      className={`app-card${available ? '' : ' app-card--disabled'}`}
                      onClick={available ? () => openApp(app) : undefined}
                      role={available ? 'button' : undefined}
                      tabIndex={available ? 0 : undefined}
                      aria-label={available ? `Open ${app.name}` : undefined}
                      onKeyDown={
                        available
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openApp(app);
                              }
                            }
                          : undefined
                      }
                    >
                      <Container
                        header={
                          <Header variant="h2">
                            <SpaceBetween direction="horizontal" size="xs">
                              <Icon
                                name={app.icon as IconProps.Name}
                                size="medium"
                                variant="link"
                              />
                              <span>{app.name}</span>
                            </SpaceBetween>
                          </Header>
                        }
                      >
                        <SpaceBetween size="m">
                          <Badge color="blue">{app.category}</Badge>
                          <Box variant="p">{app.description}</Box>
                          {/* stopPropagation so the button click doesn't also
                              trigger the card's onClick (avoids double-nav) */}
                          <span onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="primary"
                              iconName="arrow-right"
                              iconAlign="right"
                              onClick={() => openApp(app)}
                              disabled={!available}
                            >
                              {available ? 'Open' : 'Coming soon'}
                            </Button>
                          </span>
                        </SpaceBetween>
                      </Container>
                    </div>
                  );
                })}
              </Grid>
            )}
          </SpaceBetween>
        </Box>
      </ContentLayout>
    </>
  );
}
