import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

export default function Home(): ReactNode {
  return (
    <Layout title="Aura" description="Self-hosted agent platform (Joylitix)">
      <header className={clsx('hero', styles.heroBanner)}>
        <div className="container">
          <Heading as="h1" className="hero__title">
            Aura
          </Heading>
          <p className="hero__subtitle">
            Self-hosted agent platform — VS Code extension, daemon, and docs that
            ship with the code.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/intro">
              Read the docs
            </Link>
          </div>
        </div>
      </header>
    </Layout>
  );
}
