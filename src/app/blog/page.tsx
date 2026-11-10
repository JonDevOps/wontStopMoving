import { allPublicPosts } from '@/lib/server/blog';
import { BlogListing } from './blog-listing';

// Scheduled posts appear within five minutes of their publish time.
export const revalidate = 300;

export default async function BlogListingPage() {
  return <BlogListing posts={await allPublicPosts()} />;
}
