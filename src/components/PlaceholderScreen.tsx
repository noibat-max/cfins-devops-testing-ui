import { useNavigate } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import WorkbenchTopBar from './WorkbenchTopBar';
import AppNavBar from './AppNavBar';

interface Props {
  title: string;
  description?: string;
  /** When set, shown as the selected-app context in the workbench bar. */
  selectedAppName?: string;
  /** Optional second-row app navigation bar (stub) shown below the workbench bar. */
  appNav?: string[];
}

/**
 * Generic "not built in this slice yet" screen. Lets the login -> landing ->
 * (app | admin) navigation flow resolve to a real, branded page while the
 * actual application/admin screens are still in spec mode.
 */
export default function PlaceholderScreen({
  title,
  description,
  selectedAppName,
  appNav,
}: Props) {
  const navigate = useNavigate();

  return (
    <>
      <WorkbenchTopBar selectedAppName={selectedAppName} />

      {/* Per-application navigation bar (second row) */}
      {appNav && <AppNavBar items={appNav} />}

      <ContentLayout
        header={
          <Box padding={{ top: 'l', horizontal: 'l' }}>
            <Header variant="h1" description={description}>
              {title}
            </Header>
          </Box>
        }
      >
        <Box padding={{ horizontal: 'l', bottom: 'xxl' }}>
          <Container>
            <SpaceBetween size="m">
              <Box variant="p" color="text-body-secondary">
                This screen isn’t part of the current login + landing slice yet —
                it’s a placeholder so the navigation flow resolves end to end.
              </Box>
              <Button iconName="arrow-left" onClick={() => navigate('/')}>
                Back to applications
              </Button>
            </SpaceBetween>
          </Container>
        </Box>
      </ContentLayout>
    </>
  );
}
