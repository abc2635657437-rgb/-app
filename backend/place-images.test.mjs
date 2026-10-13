import assert from 'node:assert/strict';
import {imageIds} from './place-images.mjs';
assert.deepEqual(imageIds('Q45178|Q45178|Q60'),['Q45178','Q60']);
for(const value of ['', 'Q1<script>', 'Q1, Q2', Array.from({length:25},(_,i)=>'Q'+i).join('|')])assert.throws(()=>imageIds(value));
console.log('Place image IDs passed: bounded batches, deduplication and strict validation.');
