import { TechItem } from './types';

// iconSlug = Simple Icons CDN slug. https://simpleicons.org
export const TECH_CATALOG: TechItem[] = [
  // Frontend
  { id: 'react',         label: 'React',         color: '#61DAFB', abbr: 'Re', category: 'frontend',   iconSlug: 'react' },
  { id: 'nextjs',        label: 'Next.js',       color: '#000000', abbr: 'Nx', category: 'frontend',   iconSlug: 'nextdotjs' },
  { id: 'vue',           label: 'Vue',           color: '#42B883', abbr: 'Vu', category: 'frontend',   iconSlug: 'vuedotjs' },
  { id: 'angular',       label: 'Angular',       color: '#DD0031', abbr: 'Ng', category: 'frontend',   iconSlug: 'angular' },
  // Backend
  { id: 'nodejs',        label: 'Node.js',       color: '#339933', abbr: 'No', category: 'backend',    iconSlug: 'nodedotjs' },
  { id: 'python',        label: 'Python',        color: '#3776AB', abbr: 'Py', category: 'backend',    iconSlug: 'python' },
  { id: 'go',            label: 'Go',            color: '#00ADD8', abbr: 'Go', category: 'backend',    iconSlug: 'go' },
  { id: 'java',          label: 'Java',          color: '#ED8B00', abbr: 'Ja', category: 'backend',    iconSlug: 'openjdk' },
  { id: 'rust',          label: 'Rust',          color: '#CE422B', abbr: 'Rs', category: 'backend',    iconSlug: 'rust' },
  { id: 'dotnet',        label: '.NET',          color: '#512BD4', abbr: 'Dn', category: 'backend',    iconSlug: 'dotnet' },
  // Database
  { id: 'postgres',      label: 'PostgreSQL',    color: '#336791', abbr: 'Pg', category: 'database',   iconSlug: 'postgresql' },
  { id: 'mongodb',       label: 'MongoDB',       color: '#47A248', abbr: 'Mg', category: 'database',   iconSlug: 'mongodb' },
  { id: 'mysql',         label: 'MySQL',         color: '#4479A1', abbr: 'My', category: 'database',   iconSlug: 'mysql' },
  { id: 'cassandra',     label: 'Cassandra',     color: '#1287B1', abbr: 'Ca', category: 'database',   iconSlug: 'apachecassandra' },
  { id: 'dynamodb',      label: 'DynamoDB',      color: '#4053D6', abbr: 'Dy', category: 'database',   iconSlug: 'amazondynamodb' },
  // Cache
  { id: 'redis',         label: 'Redis',         color: '#DC382D', abbr: 'Rd', category: 'cache',      iconSlug: 'redis' },
  { id: 'memcached',     label: 'Memcached',     color: '#6B9B3A', abbr: 'Mc', category: 'cache',      iconSlug: 'memcached' },
  // Cloud
  { id: 'aws',           label: 'AWS',           color: '#FF9900', abbr: 'AW', category: 'cloud',      iconSlug: 'amazonwebservices' },
  { id: 'gcp',           label: 'GCP',           color: '#4285F4', abbr: 'GC', category: 'cloud',      iconSlug: 'googlecloud' },
  { id: 'azure',         label: 'Azure',         color: '#0078D4', abbr: 'Az', category: 'cloud',      iconSlug: 'microsoftazure' },
  // Infrastructure
  { id: 'docker',        label: 'Docker',        color: '#2496ED', abbr: 'Dk', category: 'infra',      iconSlug: 'docker' },
  { id: 'kubernetes',    label: 'Kubernetes',    color: '#326CE5', abbr: 'K8', category: 'infra',      iconSlug: 'kubernetes' },
  { id: 'terraform',     label: 'Terraform',     color: '#7B42BC', abbr: 'Tf', category: 'infra',      iconSlug: 'terraform' },
  { id: 'nginx',         label: 'Nginx',         color: '#009639', abbr: 'Nx', category: 'infra',      iconSlug: 'nginx' },
  // Messaging
  { id: 'kafka',         label: 'Kafka',         color: '#231F20', abbr: 'Kf', category: 'messaging',  iconSlug: 'apachekafka' },
  { id: 'rabbitmq',      label: 'RabbitMQ',      color: '#FF6600', abbr: 'Rb', category: 'messaging',  iconSlug: 'rabbitmq' },
  { id: 'sqs',           label: 'AWS SQS',       color: '#FF4F8B', abbr: 'SQ', category: 'messaging',  iconSlug: 'amazonsqs' },
  // Monitoring
  { id: 'grafana',       label: 'Grafana',       color: '#F46800', abbr: 'Gr', category: 'monitoring', iconSlug: 'grafana' },
  { id: 'prometheus',    label: 'Prometheus',    color: '#E6522C', abbr: 'Pr', category: 'monitoring', iconSlug: 'prometheus' },
  { id: 'datadog',       label: 'Datadog',       color: '#632CA6', abbr: 'Dd', category: 'monitoring', iconSlug: 'datadog' },
  // Auth
  { id: 'auth0',         label: 'Auth0',         color: '#EB5424', abbr: 'A0', category: 'auth',       iconSlug: 'auth0' },
  { id: 'keycloak',      label: 'Keycloak',      color: '#4D4D4D', abbr: 'Kc', category: 'auth',       iconSlug: 'keycloak' },
  // AI
  { id: 'openai',        label: 'OpenAI',        color: '#412991', abbr: 'Oa', category: 'ai',         iconSlug: 'openai' },
  { id: 'anthropic',     label: 'Anthropic',     color: '#C87250', abbr: 'An', category: 'ai',         iconSlug: 'anthropic' },
  { id: 'huggingface',   label: 'HuggingFace',   color: '#FFD21E', abbr: 'HF', category: 'ai',         iconSlug: 'huggingface' },
  // CDN
  { id: 'cloudflare',    label: 'Cloudflare',    color: '#F38020', abbr: 'Cf', category: 'cdn',        iconSlug: 'cloudflare' },
  { id: 'cloudfront',    label: 'CloudFront',    color: '#8C4FFF', abbr: 'CF', category: 'cdn',        iconSlug: 'amazoncloudfront' },
  // Search
  { id: 'elasticsearch', label: 'Elasticsearch', color: '#005571', abbr: 'Es', category: 'search',     iconSlug: 'elasticsearch' },
];

export const getTech = (id: string) => TECH_CATALOG.find(t => t.id === id);

export const TECH_BY_CATEGORY = TECH_CATALOG.reduce<Record<string, TechItem[]>>((acc, t) => {
  if (!acc[t.category]) acc[t.category] = [];
  acc[t.category].push(t);
  return acc;
}, {});

export const CATEGORY_LABELS: Record<string, string> = {
  frontend: 'Frontend', backend: 'Backend', database: 'Database',
  cache: 'Cache', cloud: 'Cloud', infra: 'Infrastructure',
  messaging: 'Messaging', monitoring: 'Monitoring',
  auth: 'Auth', ai: 'AI / ML', cdn: 'CDN', search: 'Search',
};

export const NODE_TYPE_COLORS: Record<string, string> = {
  service: '#5B8DEF', database: '#336791', queue: '#F46800',
  gateway: '#00C9A7', frontend: '#61DAFB', cache: '#DC382D',
  auth: '#EB5424', monitor: '#F46800', cdn: '#F48120',
  ml: '#C87250', external: '#9CA3AF', shape: '#6F6A60',
};
