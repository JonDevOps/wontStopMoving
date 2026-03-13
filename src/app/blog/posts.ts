
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
}

const generateMonthPosts = (year: number, monthName: string, monthIndex: number): BlogPost[] => {
  const categories = ["Safety", "Packing", "Logistics", "Efficiency", "Family", "Finances", "Tips", "Regions", "Settling In", "Planning"];
  const images = ["blog-winter", "blog-holiday", "blog-logistics", "blog-home", "blog-junk", "blog-budget", "blog-kids", "blog-fragile", "blog-checklist", "blog-newyear"];
  
  return Array.from({ length: 10 }).map((_, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    const category = categories[i % categories.length];
    const image = images[i % images.length];
    
    return {
      slug: `${monthName.toLowerCase()}-${year}-post-${i + 1}`,
      title: `${monthName} ${year}: ${category} Insight #${i + 1}`,
      excerpt: `Professional advice on ${category.toLowerCase()} for your ${monthName} move in ${year}.`,
      content: `Moving in ${monthName} ${year} requires careful ${category.toLowerCase()} strategies. Our nationwide network of 51,000 movers across 51 regions has seen it all. In this article, we dive deep into how to optimize your relocation specifically for ${monthName}'s unique conditions. Whether you're moving locally or nationwide, these ${category.toLowerCase()} tips will ensure a smooth transition for you and your family.`,
      category: category,
      date: `${monthName.substring(0, 3)} ${day}, ${year}`,
      readTime: `${5 + (i % 5)} min read`,
      image: image
    };
  });
};

const posts2025: BlogPost[] = [
  ...generateMonthPosts(2025, "December", 11),
  ...generateMonthPosts(2025, "November", 10),
  ...generateMonthPosts(2025, "October", 9),
  ...generateMonthPosts(2025, "September", 8),
  ...generateMonthPosts(2025, "August", 7),
  ...generateMonthPosts(2025, "July", 6),
  ...generateMonthPosts(2025, "June", 5),
  ...generateMonthPosts(2025, "May", 4),
  ...generateMonthPosts(2025, "April", 3),
  ...generateMonthPosts(2025, "March", 2),
  ...generateMonthPosts(2025, "February", 1),
  ...generateMonthPosts(2025, "January", 0),
];

const posts2024: BlogPost[] = [
  ...generateMonthPosts(2024, "December", 11),
  ...generateMonthPosts(2024, "November", 10),
  ...generateMonthPosts(2024, "October", 9),
  ...generateMonthPosts(2024, "September", 8),
  ...generateMonthPosts(2024, "August", 7),
  ...generateMonthPosts(2024, "July", 6),
  ...generateMonthPosts(2024, "June", 5),
  ...generateMonthPosts(2024, "May", 4),
  ...generateMonthPosts(2024, "April", 3),
  ...generateMonthPosts(2024, "March", 2),
  ...generateMonthPosts(2024, "February", 1),
  ...generateMonthPosts(2024, "January", 0),
];

export const BLOG_POSTS: BlogPost[] = [...posts2025, ...posts2024];
