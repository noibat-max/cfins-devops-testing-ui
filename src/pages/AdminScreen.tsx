import { useParams } from 'react-router-dom';
import PlaceholderScreen from '../components/PlaceholderScreen';

const TITLES: Record<string, string> = {
  users: 'Administration · Users',
  audit: 'Administration · Audit logs',
};

/** Workbench-global Administration screens (reached from the user menu). */
export default function AdminScreen() {
  const { section } = useParams();
  const title = (section && TITLES[section]) ?? 'Administration';
  return <PlaceholderScreen title={title} />;
}
