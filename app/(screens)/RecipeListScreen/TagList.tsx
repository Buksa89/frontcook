import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import Tag from '../../../database/models/Tag';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Q } from '@nozbe/watermelondb';
import { asyncStorageService } from '../../../app/services/storage';

interface TagListProps {
  tags: Tag[];
  selectedTags: Tag[];
  onSelectTag: (tag: Tag) => void;
}

// Base component that receives tags as a prop
export const TagList = ({ tags, selectedTags, onSelectTag }: TagListProps) => (
  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false}
    style={styles.tagsScroll}
    contentContainerStyle={styles.tagsContainer}
  >
    {tags.map(tag => (
      <TouchableOpacity
        key={tag.id}
        style={[
          styles.tagButton,
          selectedTags.some(t => t.id === tag.id) && styles.tagButtonSelected
        ]}
        onPress={() => onSelectTag(tag)}
      >
        <Text style={[
          styles.tagText,
          selectedTags.some(t => t.id === tag.id) && styles.tagTextSelected
        ]}>
          {tag.name}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

// Enhance the TagList component to observe tags from the database
const enhance = withObservables<{ selectedTags: Tag[]; onSelectTag: (tag: Tag) => void }, { tags: Observable<Tag[]> }>([], () => ({
  tags: from(asyncStorageService.getActiveUser()).pipe(
    mergeMap(activeUser => 
      database.get<Tag>('tags')
        .query(Q.where('owner', Q.eq(activeUser)))
        .observe()
    )
  )
}));

export const EnhancedTagList = enhance(TagList);

const styles = StyleSheet.create({
  tagsScroll: {
    flex: 1,
    marginRight: 4,
  },
  tagsContainer: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
    flexDirection: 'row',
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  tagButtonSelected: {
    backgroundColor: '#2196F3',
  },
  tagText: {
    fontSize: 14,
    color: '#666',
  },
  tagTextSelected: {
    color: '#fff',
  },
}); 