
import { PublicLayout } from '@/components/layout/public-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { BLOG_POSTS } from './posts';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function BlogListingPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Blog Hero */}
        <section className="bg-primary pt-40 pb-24 text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter">
              THE <span className="text-accent">MOVEMENT</span> BLOG
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Expert advice, packing hacks, and logistics insights from our nationwide network of 51,000 professional movers.
            </p>
          </div>
        </section>

        {/* Blog Grid */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {BLOG_POSTS.map((post) => {
                const postImage = PlaceHolderImages.find(img => img.id === post.image);
                return (
                  <Card key={post.slug} className="border-none shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col">
                    <div className="h-64 relative overflow-hidden">
                      <Image 
                        src={postImage?.imageUrl || "https://picsum.photos/seed/blog/800/600"}
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        data-ai-hint={postImage?.imageHint || "moving"}
                      />
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-accent hover:bg-accent text-white font-black uppercase tracking-widest text-[10px]">
                          {post.category}
                        </Badge>
                      </div>
                    </div>
                    <CardHeader className="flex-1">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.date}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {post.readTime}</span>
                      </div>
                      <CardTitle className="text-2xl font-black text-primary group-hover:text-accent transition-colors leading-tight mb-4">
                        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                      </CardTitle>
                      <p className="text-muted-foreground leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button asChild variant="ghost" className="p-0 h-auto text-accent font-black hover:bg-transparent hover:text-accent/80 group/btn">
                        <Link href={`/blog/${post.slug}`} className="inline-flex items-center">
                          Read Full Article <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-2 transition-transform" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto bg-primary text-white p-12 rounded-3xl text-center space-y-6">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Get Moving Tips in Your Inbox</h2>
              <p className="text-white/70 max-w-xl mx-auto">
                Join our community of over 1 million happy customers and receive our monthly newsletter with exclusive moving deals and professional hacks.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="flex-1 bg-white/10 border border-white/20 rounded-full px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Button className="bg-accent hover:bg-accent/90 rounded-full px-8 font-black uppercase tracking-widest text-xs">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
