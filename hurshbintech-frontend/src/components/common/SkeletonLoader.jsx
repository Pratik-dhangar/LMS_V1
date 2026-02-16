import React from 'react';
import '../../styles/components/SkeletonLoader.css';

/**
 * SkeletonLoader Component
 * 
 * Provides various skeleton loading placeholders to improve perceived performance
 * and prevent layout shifts during content loading.
 */

export const HeroSkeleton = () => (
  <div className="skeleton-hero">
    <div className="skeleton-nav-links">
      <div className="skeleton-link"></div>
      <div className="skeleton-link"></div>
      <div className="skeleton-link"></div>
    </div>
    <div className="skeleton-title"></div>
    <div className="skeleton-subtitle"></div>
  </div>
);

export const CoachSkeleton = () => (
  <div className="skeleton-coach-section">
    <div className="skeleton-coach-container">
      <div className="skeleton-coach-image"></div>
      <div className="skeleton-coach-content">
        <div className="skeleton-coach-name"></div>
        <div className="skeleton-coach-bio"></div>
        <div className="skeleton-coach-bio"></div>
        <div className="skeleton-coach-bio short"></div>
        <div className="skeleton-coach-button"></div>
      </div>
    </div>
  </div>
);

export const ServiceCardsSkeleton = () => (
  <div className="skeleton-services-section">
    <div className="skeleton-section-header">
      <div className="skeleton-heading"></div>
      <div className="skeleton-description"></div>
    </div>
    <div className="skeleton-cards-grid">
      {[...Array(8)].map((_, index) => (
        <div key={index} className="skeleton-card">
          <div className="skeleton-card-badge"></div>
          <div className="skeleton-card-emoji"></div>
          <div className="skeleton-card-title"></div>
        </div>
      ))}
    </div>
  </div>
);

export const BlogCardSkeleton = () => (
  <div className="skeleton-blog-card">
    <div className="skeleton-blog-image"></div>
    <div className="skeleton-blog-content">
      <div className="skeleton-blog-title"></div>
      <div className="skeleton-blog-excerpt"></div>
      <div className="skeleton-blog-excerpt short"></div>
      <div className="skeleton-blog-footer">
        <div className="skeleton-blog-date"></div>
        <div className="skeleton-blog-link"></div>
      </div>
    </div>
  </div>
);

export const VlogCardSkeleton = () => (
  <div className="skeleton-vlog-card">
    <div className="skeleton-vlog-thumbnail"></div>
    <div className="skeleton-vlog-content">
      <div className="skeleton-vlog-title"></div>
      <div className="skeleton-vlog-description"></div>
      <div className="skeleton-vlog-footer">
        <div className="skeleton-vlog-date"></div>
        <div className="skeleton-vlog-link"></div>
      </div>
    </div>
  </div>
);

export const ContentSectionSkeleton = ({ count = 3 }) => (
  <section className="skeleton-section">
    <div className="skeleton-section-container">
      <div className="skeleton-section-header-block">
        <div className="skeleton-section-title"></div>
        <div className="skeleton-section-subtitle"></div>
      </div>
      <div className="skeleton-section-grid">
        {[...Array(count)].map((_, index) => (
          <BlogCardSkeleton key={index} />
        ))}
      </div>
    </div>
  </section>
);

export default {
  HeroSkeleton,
  CoachSkeleton,
  ServiceCardsSkeleton,
  BlogCardSkeleton,
  VlogCardSkeleton,
  ContentSectionSkeleton,
};
