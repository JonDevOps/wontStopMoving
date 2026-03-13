
import { PublicLayout } from '@/components/layout/public-layout';
import { BLOG_POSTS } from '../posts';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowLeft, User, Share2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function BlogPostDetail({ params }: { params: { slug: string } }) {
  const post = BLOG_POSTS.find(p => p.slug === params.slug);

  if (!post) {
    notFound();
  }

  const postImage = PlaceHolderImages.find(img => img.id === post.image);

  return (
    <PublicLayout>
      <article className="min-h-screen">
        {/* Post Hero */}
        <header className="bg-primary pt-40 pb-20 text-white overflow-hidden">
          <div className="container mx-auto px-4">
            <Link href="/blog" className="inline-flex items-center gap-2 text-accent font-black uppercase tracking-widest text-xs mb-8 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </Link>
            <div className="max-w-4xl">
              <Badge className="bg-accent hover:bg-accent text-white font-black uppercase tracking-widest text-xs mb-6">
                {post.category}
              </Badge>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-tight mb-8">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-8 text-sm font-bold text-white/60 uppercase tracking-widest">
                <span className="flex items-center gap-2"><User className="h-4 w-4 text-accent" /> Wont Stop Team</span>
                <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-accent" /> {post.date}</span>
                <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> {post.readTime}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row gap-16">
              {/* Content Body */}
              <div className="lg:w-2/3">
                <div className="aspect-video relative rounded-3xl overflow-hidden mb-12 shadow-2xl">
                  <Image 
                    src={postImage?.imageUrl || "https://picsum.photos/seed/blog/1200/800"}
                    alt={post.title}
                    fill
                    className="object-cover"
                    priority
                    data-ai-hint={postImage?.imageHint || "moving"}
                  />
                </div>
                
                <div className="prose prose-xl max-w-none prose-primary font-body leading-relaxed text-primary/80">
                  <p className="text-2xl font-bold text-primary mb-8 italic border-l-4 border-accent pl-6">
                    {post.excerpt}
                  </p>
                  <div className="space-y-6">
                    {post.content.split('. ').map((sentence, i) => (
                      <p key={i} className="mb-4">{sentence}{i < post.content.split('. ').length - 1 ? '.' : ''}</p>
                    ))}
                  </div>
                  
                  <div className="bg-gray-50 p-8 rounded-3xl mt-16 border border-gray-100">
                    <h3 className="text-primary font-black uppercase mb-4">Summary Tips</h3>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Always plan at least 8 weeks in advance for a nationwide move.</li>
                      <li>Label boxes on the sides for visibility during stacking.</li>
                      <li>Maintain a 'First Night' box with essentials.</li>
                      <li>Involve family members and pets in the transition process.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-16 pt-8 border-t flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black uppercase text-muted-foreground">Share this:</span>
                    <Button variant="ghost" size="icon" className="rounded-full hover:text-accent"><Share2 className="h-5 w-5" /></Button>
                  </div>
                  <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-8">
                    <Link href="/quote">Get Your Free Quote</Link>
                  </Button>
                </div>
              </div>

              {/* Sidebar */}
              <aside className="lg:w-1/3 space-y-12">
                <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                  <h4 className="text-primary font-black uppercase tracking-widest text-xs mb-6">Recent Articles</h4>
                  <div className="space-y-8">
                    {BLOG_POSTS.filter(p => p.slug !== params.slug).slice(0, 3).map((recent) => (
                      <Link key={recent.slug} href={`/blog/${recent.slug}`} className="group block space-y-2">
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest">{recent.category}</span>
                        <h5 className="font-bold text-primary group-hover:text-accent transition-colors leading-tight">
                          {recent.title}
                        </h5>
                      </Link>
                    ))}
                  </div>
                  <Button asChild variant="link" className="p-0 h-auto text-accent font-black mt-8 hover:no-underline">
                    <Link href="/blog">View All Articles</Link>
                  </Button>
                </div>

                <div className="bg-accent text-white p-8 rounded-3xl shadow-xl shadow-accent/20">
                  <h4 className="font-black uppercase tracking-tighter text-2xl mb-4">Moving Soon?</h4>
                  <p className="text-white/80 mb-8 text-sm leading-relaxed">
                    Our 51,000 professional movers across 51 regions are ready to make your relocation simple and stress-free.
                  </p>
                  <Button asChild className="w-full bg-white text-accent hover:bg-gray-100 font-black uppercase tracking-widest text-xs rounded-xl h-12">
                    <Link href="/quote">Get Instant Quote</Link>
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </article>
    </PublicLayout>
  );
}
