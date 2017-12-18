# MediaShare

`MediaShare` is a concept representing a user created a **set** of media to a **set** of other users.

An `MediaShare` object in memory keeps tracking of the following properties:

1. uuid, a unique identifier of this share.
2. creator, the creator uuid of this share, only one.
3. maintainer, users who have the permission to add or remove the media of this share. Not sure if he or she can delete comments other than himself/herself.
4. viewer, users who are authorized to view the media of this share.
5. media, a collection of media identifiers, creators, and interface (interface may be dropped soon.)
6. comments, user comments on this share (not specific media)

# MediaTalk

`MediaTalk` is a concept representing all users comments on a specific media owned by a specific user. A `MediaTalk` is uniquely identified by a owner (who creates it implicitly) and a media. The owner must owns this media.

`MediaTalk` is not explicitly created by users. Instead, it is **IMPLICITLY** created when users share their media.

When a media is shared by the user for the first time, conceptually, he or she created a `MediaTalk` stream, which opens the possibility for users to add their comment on this media to this stream.

One media has at most one `MediaTalk` associated with it. When user share the same media again and again, he or she may add more and more other users to participate the conversation on the media, but not creating a separate new `MediaTalk` stream.

## Comment authorization

Given a `MediaTalk`, with owner as Charlie and media identified by its checksum.

If there exists at least one `MediaShare`, created by Charlie, that includes Alice as the maintainer or viewer, then:

Alice is authorized to add or remove her own comment to the given `MediaTalk`. We may also say, that or those `MediaShares` authorized Alice to participate this `MediaTalk`.

## Comment view authorization

Another design issue is, not all users participating a `MediaTalk` should view all other participant's comment.

For example, Charlie created a `MediaShare` including photo A to his parents (as viewer). Meanwhile, he also created a `MediaShare` including the same photo to his friends, Bob and Frank.

By definition, both Charlie's parents, Bob and Frank, participate Charlie's `MediaTalk` for photo A. But it may be a disaster for Charlie to allow his parent to view the comments from Bob and Frank.

We need an authorization system to determine which participant's comment in a given `MediaTalk` can be viewed by which other participants.

Given a `MediaTalk`, with owner as Charlie, and media identified by checksum. For any two participants, say, Alice and Bob, if there exists at least one `MediaShare`, created by Charlie that:

* includes the given media,
* includes both Alice and Bob in the maintainer or viewer set.

then we say:

Charlie has authorized Alice and Bob to view each other's comment on this `MediaTalk`.

In terms of set theory, this relationship is obviously reflexive (one can view his/her own comment), commutative (two users can view each others comment mutually, not one can but the other cannot), but not transitive (Alice can view Bob's comment and Bob can view Frank's comment does not necessarily mean Alice can view Frank's).

## A few words on implementation.

There are three levels on `MediaTalk` in terms of granularity:

* talk (all comments)
* user (comments grouped and canonically formatted by user)
* comment (each single comment)

Unlike `MediaShare`, in that, all related users may get a copy of the latest document, exactly the same one as the creator. For `MediaTalk`, each participant gets a filtered `view` of the original document maintained by its creator. The creator must have a way to calculate the view's digest efficiently, if `iblt` is used for data synchronization.

The digest of per participant's view can be represented by a **UNION** of **user level** digest. The later can be memoized in memory and this drastically reduce the overhead for calculating the view's digest.

Shares are indexed by media, for quickly figure out all shares that including a media. It is not hard to get the union set of `MediaShare`'s viewer set that includes the given user. This set can be named as the `Mutually Comment Viewer Set` for given user and given `MediaTalk` (that is, given media).

After we have this set, we can quickly calculate the UNION of corresponding user's digest. That is why we choose user level digest for memoization.
