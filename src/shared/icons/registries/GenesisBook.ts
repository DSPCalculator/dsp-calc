import {groupIconUrls} from '../iconRegistryHelpers';

const icon_modules = import.meta.glob('../../../../icon/GenesisBook/*.png', {
    import: 'default',
    eager: true,
});

export default groupIconUrls(icon_modules).GenesisBook || {};
